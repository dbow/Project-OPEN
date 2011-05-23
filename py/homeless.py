#!/usr/bin/python

import wikipedia
import pywikibot
import query

params = {
  'action':     'query',
  'generator':  'allpages',
  'gaplimit':   500,
}

homeless_site = wikipedia.getSite('en', 'sfhomeless')

i = 0
while True:
  results = query.GetData(params, site=homeless_site)
  for result in results['query']['pages'].values():
    print "%d : %s" % (i, result)
    i += 1
    page = wikipedia.Page(homeless_site, result['title'])
    try:
      page_contents = page.get()
      # Do something with page contents here.
      print page_contents
    except pywikibot.exceptions.IsRedirectPage as e:
      pass

  if results.has_key('query-continue'):
    params.update(results['query-continue']['allpages'])
    results = query.GetData(params, encodeTitle=False, site=homeless_site)
  else:
    break
