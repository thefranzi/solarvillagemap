/* mobile-controls.js: ensure bottom toolbar exists */
(function(){
  function init(){
    if(document.getElementById('bottom-toolbar-fixed')) return;
    var tray = document.createElement('div');
    tray.id = 'bottom-toolbar-fixed';
    document.body.appendChild(tray);
  }
  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', init);
})();
