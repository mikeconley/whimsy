/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true,
  strict:true, undef:true, unused:true, curly:true, browser:true, white:true,
  moz:true, esnext:false, indent:2, maxerr:50, devel:true, node:true, boss:true,
  globalstrict:true, nomen:false, newcap:false */

"use strict";

var clipboard = require('sdk/clipboard');
var cm = require('sdk/context-menu');
var Etherpad = require('./etherpad').Etherpad;
var etherpad = new Etherpad('thumbnail-gifs');
var prefs = require('sdk/simple-prefs');
var privateBrowsing = require('sdk/private-browsing');
var self = require('sdk/self');
var tabs = require('sdk/tabs');
var timeout = require('sdk/timers').setTimeout;

var worker = null;
var menuitem;  // Context menu item to copy thumbnail URL.

const PRIVATE_THUMBS = [
  "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcRz7aAUMhPIKvcAiFWokRIbILbwTI3OCTGYMuefA5PciEYzsIUEnw",
  "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcS913tBN0-2OIAHotcjx8oYsKKoWAXffmb8P9pp44UGUBr9c4oj_g",
  "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcTAcsmLmu2L9KYzXGQ-4DBSS8930IriKJoxSRuGL3BmJfDH2MJ-",
  "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcQd_g-T0FZEJbg_LgT_LcSSSqlDa9_wwwoIND-1usLtpWFjWHic",
  "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcQTswAxCw4KUoqfQd-ayxyu7udW1lSE-kwH1WsMjm42EfUDq8PEug",
  "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcQlCQaf-K2bqFojqxSvkRlqLHdAJUMEbCyH0bN_St0vUxbbexVW",
  "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcQ50GKva5FC_Nso3YNxQ1YSHgGIOXc8yfQnBQMZ7S-uJ-V8Tkrl",
  "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcRXU8DGYZPIQByrnccrW4kdZ9NvhoAABwqhNjZnQdRKEe3Ur8rDEA",
  "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcRBJvyZNEqevDPgBgPaqNutEXqXzrVNFNh16Ut5ONpPqfCDNUqftA",
];

etherpad.setDefaults([
  'http://25.media.tumblr.com/tumblr_ma7rqzY6zQ1qis5xyo1_400.gif',
  'https://lh3.googleusercontent.com/-OUw4Q9scVeA/T88ag2ms7nI/AAAAAAAAGYk/k61JJgULnL0/s320/90.gif',
  'https://lh4.googleusercontent.com/-CRSjITDmb4I/USZTvuI_07I/AAAAAAAAIlU/CLKU1HbMC3c/w497-h373/dsf43.gif',
  'http://i.imgur.com/7Bo2HBb.gif',
  'https://gs1.wac.edgecastcdn.net/8019B6/data.tumblr.com/5dd5ebbd60379914270b43e5e9644465/tumblr_mkme23FRxa1qb5gkjo1_400.gif',
  'http://i.imgur.com/VPFVw.gif',
  'http://i.imgur.com/6xaYo.gif',
  'http://i.imgur.com/N0Qe0.gif',
  'http://i.imgur.com/2hyBM.gif',
  'http://i.imgur.com/yjfDD.gif',
  'http://25.media.tumblr.com/tumblr_lwlcls5ra01qzrlhgo1_r1_500.gif',
  'http://media.tumblr.com/tumblr_lmuonu2zHq1qzs6oc.gif'
]);

var addContentScript = function (tab, doneTrying) {
  if (tab.url === 'about:blank' && !doneTrying) {
    // Wait a second and see if it's better then.
    timeout(function () {
      addContentScript(tab, true);
    }, 500);
  }
  if (tab.url === 'about:privatebrowsing') {
    tab.url = 'about:newtab';
  }
  if (tab.url === 'about:newtab') {
    var thumbs = etherpad.getRandomItems(9);
    if (privateBrowsing.isPrivate(tab)) {
      thumbs = PRIVATE_THUMBS;
    }
    worker = tab.attach({
      contentScriptFile: self.data.url("newtabicons-content.js"),
      contentScriptOptions: { "thumbs" : thumbs,
                              "showPref" : prefs.prefs.newtabicons2 }
    });
    worker.port.on('toggle clicked', function () {
      var pref = prefs.prefs.newtabicons2;
      pref += 1;
      pref %= 4;
      prefs.prefs.newtabicons2 = pref;
    });
    worker.port.emit('showPrefUpdated', prefs.prefs.newtabicons2);
  }
};

var tabOpen = function (tab) {
  if (!tab) {
    tab = tabs.activeTab;
  }
  return addContentScript(tab);
};

var run = function () {
  if (worker) {
    return;
  }

  etherpad.loadPlaceholders();
  tabs.on('open', tabOpen);
  tabOpen();
};

var addMenuItem = function () {
  if (!menuitem) {
    menuitem = cm.Item({
      label: 'Copy Thumbnail URL',
      context: [
        cm.URLContext('about:newtab'),
        cm.SelectorContext('.newtab-cell')
      ],
      contentScript: 'self.on("click", function(node, data) {\n' +
                     '  let thumbs = node.getElementsByClassName("newtab-thumbnail");\n' +
                     '  if (thumbs.length) {\n' +
                     '    node = thumbs[0];\n' +
                     '  }\n' +
                     '  self.postMessage("" + node.dataset.thumburl);\n' +
                     '});\n',
      onMessage: function (thumbUrl) {
        clipboard.set(thumbUrl);
      }
    });
    menuitem.image = null;
  }
};

var removeMenuItem = function () {
  if (menuitem) {
    menuitem.destroy();
    menuitem = null;
  }
};

var listener = function () {
  if (worker) {
    worker.port.emit('showPrefUpdated', prefs.prefs.newtabicons2);
  }
  if (prefs.prefs.newtabicons2 === 0 || prefs.prefs.newtabicons2 === 3) {
    removeMenuItem();
  } else {
    addMenuItem();
  }
};

exports.load = function () {
  prefs.on('newtabicons2', listener);
  run();
  listener('newtabicons2');
};

exports.unload = function () {
  prefs.removeListener('newtabicons2', listener);
  tabs.removeListener('open', tabOpen);
};
