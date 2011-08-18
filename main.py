#!/usr/bin/env python
#
# Copyright 2007 Google Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

import os
import datetime
import logging
import httplib2
import time
import urllib
from xml.dom.minidom import parseString
from authorization.oauth import OAuth
from sql.sqlbuilder import SQL
import ftclient

from google.appengine.ext import webapp, db
from google.appengine.ext.webapp import util, template
from google.appengine.api import taskqueue
from google.appengine.api import users


WIKI_URL = 'http://sfhomeless.wikia.com/'


class Resource(db.Model):
  """A resource pulled from the sfhomeless.net wiki.
  
  Each resource is based on an organization's page on the sfhomeless.net wiki.
  The WikiSyncTaskHandler cron syncs all the pages from the wiki into the
  datastore as Resources.
  
  Properties:
    name: The resource's name.
    wikiurl: The URL at the wiki which corresponds with this resource.
    summary: A paragraph summary of the resource.
    categories: A list of categories that this resource has been tagged with.
    address: The resource's address.
    phone: The resource's phone number.
    email: The resource's email address.
    website: The resource's website.
    contacts: A list of contacts (names) at the resource.
    hours: The resource's hours.
    languages: A list of the languages supported at the resource.
    image: The image (either from the wiki or a stored closeup of the map)
      associated with the resource.
    status: The status of this resource in the database.  Possible values are
      Active (if currently visible on the wiki and frontend), Incomplete (if 
      visible on the wiki but we can't pull enough information to show in the
      frontend), Deleted (if syncs with the wiki no longer return this page),
      or Excluded (if this isn't actually a resource page).
    last_updated: The date and time that this resource was last synced to the
      wiki content.
  """

  name = db.StringProperty()
  wikiurl = db.StringProperty()
  summary = db.TextProperty()
  categories = db.StringListProperty()
  address = db.PostalAddressProperty()
  phone = db.PhoneNumberProperty()
  email = db.EmailProperty()
  website = db.LinkProperty()
  contacts = db.StringProperty()
  hours = db.TextProperty()
  languages = db.StringProperty()
  image = db.BlobProperty()
  status = db.StringProperty(choices=['Active',
                                      'Incomplete',
                                      'Deleted',
                                      'Excluded'])
  last_updated = db.DateTimeProperty()


class SavedMap(db.Model):
  """TODO."""

  url = db.StringProperty()
  resources = db.StringListProperty()


class OAuthCredentials(db.Model):
  """TODO."""

  user = db.UserProperty()
  consumer_key = db.StringProperty(default='anonymous')
  consumer_secret = db.StringProperty(default='anonymous')
  token = db.StringProperty()
  secret = db.StringProperty()
  temp_token = db.StringProperty()
  temp_secret = db.StringProperty()


def getElementValue(semantic_property, element):
  """Retrieves the provided value from the provided XML node.

  Args:
    semantic_property: A string indicating which property is being retrieved.
    element: A 'property:' XML node.

  Returns:
    The text value of the XML node.
  """

  special_properties = ['Email', 'Website']
  if semantic_property in special_properties:
    return element.getAttribute('rdf:resource')
  else:
    return element.childNodes[0].nodeValue


def getResourceCategories(resource_xml):
  """Retrieves the Category values from the provided xml.

  Args:
    resource_xml: The XML document of a given resource.

  Returns:
    A list of categories (strings) for this resource.
  """

  categories = resource_xml.getElementsByTagName('owl:Class')
  category_list = []
  for category in categories:
    text = category.getElementsByTagName('rdfs:label')[0].childNodes[0].data
    category_list.append(text)
  return category_list


def getResourceInfo(resource_page):
  """Retrieves the XML for the given resource and parses it.

  Issues a GET request to the exportRDF URL for the given page and parses
  the returned XML to extract the relevant information about the resource.
  
  Args:
    resource_page: The URL name of the resource page to query.

  Returns:
    resource_info: A dictionary of properties and values for the provided
      resource.
  """

  url = WIKI_URL + str('/index.php?title=Special:ExportRDF&page=' +
                       resource_page)
  http = httplib2.Http()
  response, content = http.request(url, 'GET')
  response_xml = parseString(content).getElementsByTagName('rdf:RDF')[0]
  
  properties = [
      'Address',
      'Phone_Number',
      'Email',
      'Website',
      'Contact-28s-29',
      'Hours',
      'Language-28s-29',
      'SummaryText'
  ]
  resource_info = {}
  name_node = response_xml.getElementsByTagName('rdfs:label')[0]
  resource_info['Name'] = name_node.childNodes[0].nodeValue
  resource_info['Categories'] = getResourceCategories(response_xml)
  resource_info['Property Success'] = False
  for semantic_property in properties:
    attr_info = response_xml.getElementsByTagName('property:' +
                                                  semantic_property)
    if attr_info:
      resource_info[semantic_property] = getElementValue(semantic_property,
                                                         attr_info[0])
      resource_info['Property Success'] = True
    else:
      resource_info[semantic_property] = None

  return resource_info


def getAllPages(resource_pages, continue_query=None):
  """TODO."""

  QUERY_URL = str('http://sfhomeless.wikia.com/api.php?action=query&'
                  'list=allpages&aplimit=500&format=xml'
                  '&apfilterredir=nonredirects')
  if continue_query:
    QUERY_URL = QUERY_URL + '&apfrom=' + urllib.quote(continue_query)

  http = httplib2.Http()
  logging.info('http request')
  logging.info(QUERY_URL)
  response, content = http.request(QUERY_URL, 'GET')
  response_xml = parseString(content)
  pages = response_xml.getElementsByTagName('p')
  for page in pages:
    title = page.getAttribute('title').replace("'","%27").replace(' ','_')
    resource_pages.append(title.encode('utf-8'))

  query_continue = response_xml.getElementsByTagName('query-continue')
  if query_continue:
    allpages_continue = query_continue[0].getElementsByTagName('allpages')[0]
    apfrom = allpages_continue.getAttribute('apfrom')
    logging.info(apfrom)
    resource_pages = getAllPages(resource_pages, apfrom)

  return resource_pages


def syncResources(resource_pages):
  """TODO."""

  for resource_page in resource_pages:
    logging.info('getResourceInfo')
    logging.info(resource_page)
    resource_info = getResourceInfo(resource_page)
    decoded_url = resource_page.decode('utf-8')

    resource = Resource().all().filter('wikiurl =', decoded_url).get()
    if not resource:
      resource = Resource()
      resource.wikiurl = decoded_url
    resource.name = resource_info['Name']
  
    if resource_info['Property Success'] == True:
      resource.summary = resource_info['SummaryText']
      resource.categories = resource_info['Categories']
      resource.address = resource_info['Address']
      resource.phone = resource_info['Phone_Number']
      resource.email = resource_info['Email']
      resource.website = resource_info['Website']
      resource.contacts = resource_info['Contact-28s-29']
      resource.hours = resource_info['Hours']
      resource.languages = resource_info['Language-28s-29']
      resource.status = 'Active'
    else:
      resource.status = 'Incomplete'
    resource.last_updated = datetime.datetime.now()
    resource.put()
    time.sleep(.1)


class WikiSyncTaskHandler(webapp.RequestHandler):
  """TODO."""

  def post(self):
    """TODO."""

    resource_list = []
    resource_pages = getAllPages(resource_list)
    syncResources(resource_pages)


class WikiSyncLauncher(webapp.RequestHandler):
  """TODO."""

  def get(self):
    """TODO."""

    taskqueue.add(url='/task/wikisync')
    self.response.out.write('Task launched.')


class FusionTablesCredentialsHandler(webapp.RequestHandler):
  """Retrieves an access token for talking to the Fusion tables API."""

  def get(self):
    """Completes the OAuth dance and stores credentials in datastore."""

    auth = self.request.get('auth')
    user = users.get_current_user()
    oauth_credentials = OAuthCredentials.all().filter('user = ', user).get()
    if not oauth_credentials:
      oauth_credentials = OAuthCredentials(user=user)
      oauth_credentials.put()
    consumer_key = oauth_credentials.consumer_key
    consumer_secret = oauth_credentials.consumer_secret
  
    callback_url = 'http://localhost:8080/fusioncredentials?auth=1'
    if not auth:
      url, token, secret = OAuth().generateAuthorizationURL(consumer_key,
                                                            consumer_secret,
                                                            consumer_key,
                                                            callback_url)
      oauth_credentials.temp_token = token
      oauth_credentials.temp_secret = secret
      oauth_credentials.put()
      self.redirect(url)
    else:
      token, secret = OAuth().authorize(consumer_key,
                                        consumer_secret,
                                        oauth_credentials.temp_token,
                                        oauth_credentials.temp_secret)
      oauth_credentials.token = token
      oauth_credentials.secret = secret
      oauth_credentials.put()
      self.redirect('/fusionsync')


class FusionTablesSyncHandler(webapp.RequestHandler):
  """Pushes information from datastore into FusionTables."""

  def get(self):
    """For each Active resource, creates a row in a Fusion Table."""

    user = users.get_current_user()
    oauth_credentials = OAuthCredentials.all().filter('user = ', user).get()
    if not oauth_credentials:
      self.redirect('/fusioncredentials')
    else:
      tableid = 1293272
      tfmt = '%A, %d. %B %Y %I:%M%p'
      oauth_client = ftclient.OAuthFTClient(oauth_credentials.consumer_key,
                                            oauth_credentials.consumer_secret,
                                            oauth_credentials.token,
                                            oauth_credentials.secret)
      resources = Resource().all().filter('status =', 'Active')
      for resource in resources:
        encoded_categories = []
        for category in resource.categories:
          encoded_categories.append(category.encode('utf-8'))
        summary = 'None'
        if resource.summary:
          summary = resource.summary.encode('utf-8')
        row_info = {'ID': str(resource.key().id()),
                    'Name': resource.name.encode('utf-8'),
                    'Wiki URL': str(resource.wikiurl),
                    'Summary': summary,
                    'Categories': str(encoded_categories),
                    'Address': resource.address.encode('utf-8'),
                    'Phone': str(resource.phone),
                    'Email': str(resource.email),
                    'Website': str(resource.website),
                    'Contacts': str(resource.contacts),
                    'Hours': str(resource.hours),
                    'Languages': str(resource.languages),
                    'Image URL': 'None',
                    'Last Updated': resource.last_updated.strftime(tfmt)}
        logging.info(row_info)
        response = oauth_client.query(SQL().insert(tableid, row_info))


class MainHandler(webapp.RequestHandler):
  """The main site page providing a frontend to browse the resources."""

  def get(self):
    """Retrieves resources and passes them to the frontend."""

    resources = Resource().all().filter('status =', 'Active')

    template_values = {
        'resources': resources
    }
    path = os.path.join(os.path.dirname(__file__), 'index.html')
    self.response.out.write(template.render(path, template_values))


class WikiStatusHandler(webapp.RequestHandler):
  """A development page to display all synced resources."""

  def get(self):
    """Presents Active and Incomplete resources."""

    complete_resources = Resource().all().filter('status =', 'Active')
    incomplete_resources = Resource().all().filter('status =', 'Incomplete')
    excluded_resources = Resource().all().filter('status =', 'Excluded')
    deleted_resources = Resource().all().filter('status =', 'Deleted')

    template_values = {
        'complete_resources': complete_resources,
        'complete_num': complete_resources.count(),
        'incomplete_resources': incomplete_resources,
        'incomplete_num': incomplete_resources.count(),
        'excluded_resources': excluded_resources,
        'excluded_num': excluded_resources.count(),
        'deleted_resources': deleted_resources,
        'deleted_num': deleted_resources.count()
    }
    path = os.path.join(os.path.dirname(__file__), 'wikistatus.html')
    self.response.out.write(template.render(path, template_values))

  def post(self):
    """Updates the Status of the selected resource."""

    wikiurl = self.request.get('wiki_url')
    action = self.request.get('action')
    if action == 'Update':
      status = self.request.get('status')
      resource = Resource().all().filter('wikiurl =', wikiurl).get()
      resource.status = status
      resource.put()
    if action == 'Sync':
      page_to_list = [wikiurl]
      syncResources(page_to_list)

    self.redirect('/wikistatus')


class DirectionsHandler(webapp.RequestHandler):
  """The directions page where a user can find directions to resources."""

  def get(self):
    """Retrieves origin and destination and passes them to the frontend."""

    origin = self.request.get('origin')
    destination = self.request.get('destination')

    template_values = {
      'origin': origin,
      'destination': destination,
    }    
    path = os.path.join(os.path.dirname(__file__), 'directions.html')
    self.response.out.write(template.render(path, template_values))


def main():
    application = webapp.WSGIApplication(
        [('/', MainHandler),
         ('/wikistatus', WikiStatusHandler),
         ('/wikisync', WikiSyncLauncher),
         ('/directions', DirectionsHandler),
         ('/fusioncredentials', FusionTablesCredentialsHandler),
         ('/fusionsync', FusionTablesSyncHandler),
         ('/task/wikisync', WikiSyncTaskHandler)],
        debug=True)
    util.run_wsgi_app(application)


if __name__ == '__main__':
    main()
