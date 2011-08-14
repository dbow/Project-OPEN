$(function () {

  $('.resource_update > input').click(function() {
    var wikiUrl = $(this).parent().siblings('.resource_url').text();
    var status = $(this).prev().val();
    $('[name=wiki_url]').val(wikiUrl);
    $('[name=action]').val('Update');
    $('[name=status]').val(status);
    $('#resource_form').submit();
  });
  $('.resource_sync > input').click(function() {
    var wikiUrl = $(this).parent().next().text();
    $('[name=wiki_url]').val(wikiUrl);
    $('[name=action]').val('Sync');
    $('#resource_form').submit();
  });

});