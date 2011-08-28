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
from google.appengine.dist import use_library
use_library('django', '1.2')
import logging
import hashlib
import httplib2
import pickle
import time
import urllib
from xml.dom.minidom import parseString
from authorization.oauth import OAuth
from sql.sqlbuilder import SQL
import ftclient

from google.appengine.ext import webapp, db
from google.appengine.ext.webapp import util, template
from google.appengine.api import images
from google.appengine.api import taskqueue
from google.appengine.api import memcache
from google.appengine.api import users
from google.appengine.api import quota

WIKI_URL = 'http://sfhomeless.wikia.com/'

PARENT_CATEGORIES = ['Employment',
                     'Government',
                     'Housing',
                     'Legal',
                     'Medical',
                     'Special Groups',
                     'Other']

FUSION_TABLE_ID = 1293272

IMAGE_MAX_WIDTH = 160
IMAGE_MAX_HEIGHT = 120


class DictProperty(db.Property):
  """Allows a dictionary to be stored in datastore."""

  data_type = db.Blob

  # Disables "Invalid method name" warning
  # pylint: disable-msg=C6409
  def get_value_for_datastore(self, model_instance):
    value = getattr(model_instance, self.name)
    pickled_val = pickle.dumps(value)
    if value is not None:
      return db.Blob(pickled_val)

  def make_value_from_datastore(self, value):
    if value is not None:
      return pickle.loads(str(value))


class Resource(db.Model):
  """A resource pulled from the sfhomeless.net wiki.
  
  Each resource is based on an organization's page on the sfhomeless.net wiki.
  The WikiSyncTaskHandler cron syncs all the pages from the wiki into the
  datastore as Resources.
  
  Properties:
    name: The resource's name.
    wikiurl: The URL at the wiki which corresponds with this resource.
    summary: A paragraph summary of the resource.
    categories: The full list of categories tagged to this resource.
    frontend_categories: The list of categories tagged to this resource that
      are FrontendCategories entities.
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
  summary = db.TextProperty(default=None)
  categories = db.StringListProperty(default=None)
  frontend_categories = db.StringListProperty(default=None)
  address = db.PostalAddressProperty()
  phone = db.PhoneNumberProperty(default=None)
  email = db.EmailProperty(default=None)
  website = db.LinkProperty(default=None)
  contacts = db.StringProperty(default=None)
  hours = db.TextProperty(default=None)
  languages = db.StringProperty(default=None)
  image = db.BlobProperty(default=None)
  status = db.StringProperty(choices=['Active',
                                      'Incomplete',
                                      'Deleted',
                                      'Excluded'])
  last_updated = db.DateTimeProperty(auto_now=True)


class FrontendCategories(db.Model):
  """The categories to show in the frontend.
  
  This is based on the category listings on this page in the wiki:
  http://sfhomeless.wikia.com/wiki/Categories_Displayed_By_Subject
  
  To help users browse the large number of categories (>60) easier,
  they are grouped into 7 parent categories captured in PARENT_CATEGORIES
  above.  In the wiki, each Category page has one of the PARENT_CATEGORIES
  pages listed as a 'Category'.  The processCategories method goes through
  all the categories that any resource is a part of and determines if it
  should be in FrontendCategories based on whether it has a parent 'Category'
  in PARENT_CATEGORIES.
  """

  name = db.StringProperty()
  parent_category = db.StringProperty(choices=PARENT_CATEGORIES)


class ParentCategories(db.Model):
  """TODO."""

  name = db.StringProperty()
  image = db.BlobProperty(default=None)


class CategoryMaps(db.Model):
  """TODO."""

  category_map = DictProperty(default=None)
  child_category_map = DictProperty(default=None)


class SavedMap(db.Model):
  """A collection of resources saved by a user.
  
  When a user saves or prints or shares a My Guide map they made in the
  frontend, that specific collection of resource IDs is stored as a
  SavedMap, with a unique URL.  If the SavedMap has a name property, then
  it is a Public Map shown in the frontend.  These Public Maps are specially
  created in collaboration with specific agencies/organizations, and the name
  value is set in the admin console.
  """

  url = db.StringProperty()
  resources = db.StringListProperty()
  name = db.StringProperty()


class OAuthCredentials(db.Model):
  """The OAuth Credentials stored to talk to FusionTables."""

  user = db.UserProperty()
  consumer_key = db.StringProperty(default='anonymous')
  consumer_secret = db.StringProperty(default='anonymous')
  token = db.StringProperty()
  secret = db.StringProperty()
  temp_token = db.StringProperty()
  temp_secret = db.StringProperty()


class RunningUser(db.Model):
  """Stores the admin user whose OAuth credentials are used for tasks."""

  user = db.UserProperty(auto_current_user_add=True)


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
    category_list.append(text.encode('utf-8'))

  return category_list


def getResourceAddress(resource_xml):
  """Retrieves the Address value from the provided xml.
  
  Args:
    resource_xml: The XML document of a given resource.

  Returns:
    The string representing the address of the resource.
  """

  address = resource_xml.getElementsByTagName('property:Address')
  address_value = None
  if address:
    address_value = getElementValue('Address', address[0]).encode('utf-8')

  return address_value


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

  url = WIKI_URL + str('index.php?title=Special:ExportRDF&page=' +
                       urllib.quote(resource_page, '%'))
  http = httplib2.Http()
  response, content = http.request(url, 'GET')
  response_xml = parseString(content).getElementsByTagName('rdf:RDF')[0]
  
  properties = [
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
  resource_info['Name'] = name_node.childNodes[0].nodeValue.encode('utf-8')
  resource_info['Categories'] = getResourceCategories(response_xml)
  resource_info['Address'] = getResourceAddress(response_xml)

  resource_info['Property Success'] = False
  for semantic_property in properties:
    attr_info = response_xml.getElementsByTagName('property:' +
                                                  semantic_property)
    if attr_info:
      property_value = getElementValue(semantic_property, attr_info[0])
      resource_info[semantic_property] = property_value.encode('utf-8')
      resource_info['Property Success'] = True
    else:
      resource_info[semantic_property] = None

  return resource_info


def getResourceImage(resource_page):
  """TODO."""

  url = WIKI_URL + str('api.php?action=imageserving&format=xml&wisTitle=' +
                       urllib.quote(resource_page, '%'))
  http = httplib2.Http()
  response, content = http.request(url, 'GET')
  response_xml = parseString(content).getElementsByTagName('image')[0]
  image_url = response_xml.getAttribute('imageserving')
  if image_url:
    response, content = http.request(image_url, 'GET')
    return content
  else:
    return None    


def getAllPages(resource_pages, continue_query=None):
  """TODO."""

  QUERY_URL = WIKI_URL + str('api.php?action=query&'
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


def syncResource(resource_page):
  """TODO."""

  logging.info('getResourceInfo')
  logging.info(resource_page)
  resource_info = getResourceInfo(resource_page)
  decoded_url = resource_page.decode('utf-8')

  resource = Resource().all().filter('wikiurl =', decoded_url).get()
  if not resource:
    resource = Resource()
    resource.wikiurl = decoded_url
  resource.name = resource_info['Name'].decode('utf-8')
  resource.categories = resource_info['Categories']
  frontend_categories = []
  for category in resource_info['Categories']:
    frontend_category = FrontendCategories().all().filter('name =',
                                                          category).get()
    if frontend_category:
      frontend_categories.append(category)
  resource.frontend_categories = frontend_categories
  address = resource_info['Address']
  if resource.status != 'Excluded':
    if resource.name and resource.frontend_categories and address:
      if 'San Francisco' not in address:
        address += ' San Francisco, CA'
      resource.address = address.decode('utf-8')
      resource.status = 'Active'
    else:
      resource.status = 'Incomplete'
  if resource_info['Property Success'] == True:
    if resource_info['SummaryText']:
      resource.summary = resource_info['SummaryText'].decode('utf-8')
    if resource_info['Phone_Number']:
      resource.phone = resource_info['Phone_Number'].decode('utf-8')
    if resource_info['Email']:
      resource.email = resource_info['Email'].decode('utf-8')
    if resource_info['Website']:
      resource.website = resource_info['Website'].decode('utf-8')
    if resource_info['Contact-28s-29']:
      contacts = resource_info['Contact-28s-29'].replace('\n', '')
      resource.contacts = contacts.decode('utf-8')
    if resource_info['Hours']:
      resource.hours = resource_info['Hours'].decode('utf-8')
    if resource_info['Language-28s-29']:
      languages = resource_info['Language-28s-29'].replace('\n', '')
      resource.languages = languages.decode('utf-8')
  image_data = getResourceImage(resource_page)
  if image_data:
    image = images.Image(str(image_data))
    image.resize(width=160, height=120)
    resized_image = image.execute_transforms()
    resource.image = db.Blob(resized_image)
  resource.put()


def updateFusionTableRow(wikiurl):
  """TODO."""

  user = RunningUser.all().get()
  oauth_credentials = OAuthCredentials.all().filter('user = ', user.user).get()
  tfmt = '%A, %d. %B %Y %I:%M%p'
  oauth_client = ftclient.OAuthFTClient(oauth_credentials.consumer_key,
                                        oauth_credentials.consumer_secret,
                                        oauth_credentials.token,
                                        oauth_credentials.secret)
  decoded_url = wikiurl.decode('utf-8')
  resource = Resource().all().filter('wikiurl =', decoded_url).get()
  logging.info(resource.name)
  hours = resource.hours
  if not resource.hours:
    hours = str(resource.hours)
  summary = resource.summary
  if not resource.summary:
    summary = str(resource.summary)
  website = resource.website
  if not resource.website:
    website = str(resource.website)
  phone = resource.phone
  if not resource.phone:
    phone = str(resource.phone)
  email = resource.email
  if not resource.email:
    email = str(resource.email)
  contacts = resource.contacts
  if not resource.contacts:
    contacts = str(resource.contacts)
  language = resource.languages
  if not resource.languages:
    language = str(resource.languages)
  category_maps = retrieveCategoryMapping()
  category_map = category_maps[0]
  child_category_map = category_maps[1]
  display_filter = ''
  categories = []
  filter_categories = []
  for category in resource.frontend_categories:
    categories.append(category.encode('utf-8'))
    parent_category = child_category_map[category]
    if not display_filter:
      display_filter = parent_category
    if parent_category not in filter_categories:
      filter_categories.append(parent_category)
  image = 'False'
  if resource.image:
    image = 'True'
  row_info = {'ID': str(resource.key().id()),
              'Name': resource.name.encode('utf-8'),
              'Address': resource.address.encode('utf-8'),
              'Categories': ', '.join(categories),
              'DisplayFilter': str(display_filter),
              'FilterCategories': ', '.join(filter_categories),
              'Hours': hours.encode('utf-8'),
              'Summary': summary.encode('utf-8'),
              'Website': website.encode('utf-8'),
              'Wiki URL': wikiurl,
              'Phone': phone.encode('utf-8'),
              'Email': email.encode('utf-8'),
              'Contacts': contacts.encode('utf-8'),
              'Languages': language.encode('utf-8'),
              'Image': image,
              'Last Updated': resource.last_updated.strftime(tfmt)}
  logging.info(row_info)
  response = oauth_client.query(SQL().insert(FUSION_TABLE_ID, row_info))


class WikiSyncTaskHandler(webapp.RequestHandler):
  """TODO."""

  def post(self):
    """TODO."""

    resource_page = self.request.get('resource_page')
    syncResource(resource_page.encode('utf-8'))


class WikiSyncLauncher(webapp.RequestHandler):
  """TODO."""

  def get(self):
    """TODO."""

    resource_list = []
    resource_pages = getAllPages(resource_list)
    num = 0
    for page in resource_pages:
      taskqueue.add(url='/task/wikisync', params={'resource_page': page})
      num += 1
    self.response.out.write(str(num) + ' tasks launched.')


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
  
    callback_url = 'http://project-open.appspot.com/fusioncredentials?auth=1'
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
  """A task to update a FusionTables row for a given wiki page."""

  def post(self):
    """Retrieves the page to update and calls updateFusionTableRow on it."""

    wikiurl = self.request.get('wikiurl')
    updateFusionTableRow(wikiurl.encode('utf-8'))


class FusionTablesSyncLauncher(webapp.RequestHandler):
  """Initiates a complete sync of datastore to FusionTables."""

  def get(self):
    """For each Active resource, launches a FusionTablesSyncHandler task."""

    user = RunningUser.all().get()
    if not user:
      user = RunningUser()
      user.put()
    oauth_credentials = OAuthCredentials.all().filter('user = ', user.user).get()
    if not oauth_credentials:
      self.redirect('/fusioncredentials')
    else:
      resources = Resource().all().filter('status =', 'Active')
      num = 0
      for resource in resources:
        if resource.wikiurl:
          wikiurl = resource.wikiurl.encode('utf-8')
          taskqueue.add(url='/task/fusionsync', params={'wikiurl': wikiurl})
          num += 1
      self.response.out.write(str(num) + ' tasks launched.')


class WikiStatusHandler(webapp.RequestHandler):
  """A development page to display all synced resources."""

  def get(self):
    """Presents Active and Incomplete resources."""

    start = quota.get_request_cpu_usage()
    complete_resources = Resource().all().filter('status =', 'Active')
    incomplete_resources = Resource().all().filter('status =', 'Incomplete')
    excluded_resources = Resource().all().filter('status =', 'Excluded')
    deleted_resources = Resource().all().filter('status =', 'Deleted')

    template_values = {
        'complete_resources': complete_resources,
        'incomplete_resources': incomplete_resources,
        'excluded_resources': excluded_resources,
        'deleted_resources': deleted_resources,
    }
    end = quota.get_request_cpu_usage()
    logging.info('get request cost %d megacycles.' % (end - start))
    path = os.path.join(os.path.dirname(__file__), 'wikistatus.html')
    self.response.out.write(template.render(path, template_values))

  def post(self):
    """Updates the Status of the selected resource."""

    start = quota.get_request_cpu_usage()
    wikiurl = self.request.get('wiki_url')
    action = self.request.get('action')
    if action == 'Update':
      status = self.request.get('status')
      resource = Resource().all().filter('wikiurl =', wikiurl).get()
      resource.status = status
      resource.put()
    if action == 'WikiSync':
      wikiurl_encoded = wikiurl.encode('utf-8')
      syncResource(wikiurl_encoded)
    if action == 'FusionSync':
      wikiurl_encoded = wikiurl.encode('utf-8')
      updateFusionTableRow(wikiurl_encoded)

    end = quota.get_request_cpu_usage()
    logging.info('post request cost %d megacycles.' % (end - start))
    self.redirect('/wikistatus')


class CategoryImageUploader(webapp.RequestHandler):
  """TODO."""
  
  def get(self):
    """TODO."""

    category_selects = ''
    for category in PARENT_CATEGORIES:
      category_selects += str('<option value="' +
                              category +
                              '">' +
                              category +
                              '</option>')      
      
    self.response.out.write("""
          <form action="/categoryimage" enctype="multipart/form-data" method="post">
            <div><label>Category:</label></div>
            <div><select name="category">""" + category_selects +
            """"</select></div>
            <div><label>Image:</label></div>
            <div><input type="file" name="img"/></div>
            <div><input type="submit" value="Upload" /></div>
          </form>
        </body>
      </html>""")

  def post(self):
    """TODO."""

    image_data = self.request.get('img')
    category = self.request.get('category')
    if image_data and category:
      parent_categories = ParentCategories().all()
      parent_category = parent_categories.filter('name =', category).get()
      if not parent_category:
        parent_category = ParentCategories(name=category)
      image = images.Image(image_data)
      image.resize(width=160, height=120)
      resized_image = image.execute_transforms()
      parent_category.image = db.Blob(resized_image)
      parent_category.put()


class CategorySyncTaskHandler(webapp.RequestHandler):
  """Traverses Resources to update FrontendCategories entities."""

  def post(self):
    """Assembles a list of categories and calls processCategory on each.

    Goes through each Resource in the datastore to assemble a list of all
    categories represented.  Then for each category in the list, calls
    the processCategory method to determine if the category should go in
    FrontendCategories.
    """

    resources = Resource().all()
    all_categories = {}
    for resource in resources:
      for category in resource.categories:
        if category not in all_categories:
          all_categories[category] = 1
        else:
          all_categories[category] += 1
    for category in all_categories:
      processCategory(category)


class CategorySyncLauncher(webapp.RequestHandler):
  """TODO."""

  def get(self):
    """TODO."""

    taskqueue.add(url='/task/category')
    self.response.out.write('Task launched.')


def processCategory(category):
  """Determines if a provided category should go in FrontendCategories.

  Queries the mediawiki API for information about the given
  category.  If the category has parent categories, it goes through those
  categories to see if its parent categories are within the
  PARENT_CATEGORIES list.  If so, then this category is added to the
  datastore as a FrontendCategories entity.
  """

  category_url = WIKI_URL + str('api.php?action=query&format=xml'
                                '&prop=categories&titles=Category:' +
                                urllib.quote(category, '%'))
  http = httplib2.Http()
  response, content = http.request(category_url, 'GET')
  parents = parseString(content).getElementsByTagName('cl')
  parent_category = ''
  for parent in parents:
    parent_value = parent.getAttribute('title')
    if 'Category' in parent_value:
      parent_category_name = parent_value.split(':')[1]
      if parent_category_name in PARENT_CATEGORIES:
        parent_category = parent_category_name
  if parent_category:
    frontend_category = FrontendCategories().all().filter('name =',
                                                          category).get()
    if not frontend_category:
      frontend_category = FrontendCategories()
      frontend_category.name = category
      frontend_category.parent_category = parent_category
      frontend_category.put()


def retrieveCategoryMapping():
  """TODO."""

  category_maps = CategoryMaps.all().get()
  if not category_maps:
    setCategoryMapping()

  return category_maps.category_map, category_maps.child_category_map


def setCategoryMapping():
  """TODO."""

  category_map = {}
  for parent in PARENT_CATEGORIES:
    category_map[parent] = []

  all_categories = FrontendCategories().all()
  for category in all_categories:
    parent_list = category_map[category.parent_category]
    parent_list.append(category.name.encode('utf-8'))

  category_maps = CategoryMaps.all().get()
  if not category_maps:
    category_maps = CategoryMaps()

  category_maps.category_map = category_map

  child_category_map = {}
  for parent in category_map:
      for child in category_map[parent]:
        child_category_map[child] = parent

  category_maps.child_category_map = child_category_map

  category_maps.put()
  

class MainHandler(webapp.RequestHandler):
  """The main site page providing a frontend to browse the resources."""

  def get(self):
    """Retrieves resources and passes them to the frontend."""

    resources = Resource().all().filter('status =', 'Active')
    category_map = retrieveCategoryMapping()

    template_values = {
        'resources': resources,
        'category_map': category_map,
    }
    path = os.path.join(os.path.dirname(__file__), 'index.html')
    self.response.out.write(template.render(path, template_values))


class GetImage(webapp.RequestHandler):
  """TODO."""
  def get(self):
    """TODO."""

    wikiurl = self.request.get('wikiurl')
    filter_name = self.request.get('filter')
    if wikiurl:
      resource = Resource().all().filter('wikiurl =', wikiurl).get()
      if resource and resource.image:
        self.response.headers['Content-Type'] = 'image/jpeg'
        self.response.out.write(resource.image)
    elif filter_name:
      parent_categories = ParentCategories().all()
      parent_category = parent_categories.filter('name =', filter_name).get()
      if parent_category:
        self.response.headers['Content-Type'] = 'image/jpeg'
        self.response.out.write(parent_category.image)
    else:
      self.response.out.write(None)


class SaveHandler(webapp.RequestHandler):
  """TODO."""

  def get(self):
    """TODO."""

    id_list = self.request.get('ids').sort()
    hashed_ids = hashlib.sha1(''.join(map(str, id_list))).hexdigest()
    saved_map = SavedMap().all().filter('url =', hashed_ids).get()
    if not saved_map:
      saved_map = SavedMap(url=hashed_ids)
      saved_map.resources = id_list
      saved_map.put()

    return hashed_ids


class SavedMapHandler(webapp.RequestHandler):
  """TODO."""

  def get(self):
    """TODO."""

    hashed_id = self.request.get('id')
    saved_map = SavedMap().all().filter('url =', hashed_ids).get()
    template_values = {
        'saved_map': saved_map,
    }
    path = os.path.join(os.path.dirname(__file__), 'map.html')
    self.response.out.write(template.render(path, template_values))


def main():
    application = webapp.WSGIApplication(
        [('/', MainHandler),
         ('/image', GetImage),
         ('/save', SaveHandler),
         ('/map', SavedMapHandler),
         ('/wikistatus', WikiStatusHandler),  #TODO(dbow): make admin-only.
         ('/category', CategorySyncLauncher),  #admin-only.
         ('/categoryimage', CategoryImageUploader), #admin-only.
         ('/task/category', CategorySyncTaskHandler), #admin-only.
         ('/wikisync', WikiSyncLauncher),  #admin-only.
         ('/task/wikisync', WikiSyncTaskHandler),  #admin-only.
         ('/fusioncredentials', FusionTablesCredentialsHandler),  #admin-only.
         ('/fusionsync', FusionTablesSyncLauncher),  #admin-only.
         ('/task/fusionsync', FusionTablesSyncHandler)],  #admin-only.
        debug=True)
    util.run_wsgi_app(application)


if __name__ == '__main__':
    main()
