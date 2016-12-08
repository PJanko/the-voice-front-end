module.exports = {
  build: {
    "index.html": "index.html",
    "home.html": "home.html",
    "singer.html": "singer.html",
    "form.html": "form.html",


    "app.js": [
      "js/vendors/jquery.min.js",
      "js/vendors/underscore.min.js",
      "js/vendors/angular.min.js",
      "js/vendors/angular-route.min.js",
      "js/vendors/ng-youtube-embed.min.js",
      "js/vendors/jquery.dropotron.min.js",
      "js/vendors/skel.min.js",
      "js/vendors/util.js",
      "js/vendors/main.js",
      "js/app.js",
      "js/controllers/homecontroller.js",
      "js/controllers/singercontroller.js",
      "js/controllers/formcontroller.js",
      "js/factories/toolfactory.js",
      "js/factories/ethereumfactory.js"
    ],
    "app.css": [
      "css/font-awesome.min.css",
      "css/main.css",
      "css/app.css"
    ],
    "images/": "images/",
    "fonts/": "fonts/"
  },
  rpc: {
    host: "localhost",
    port: 8545
  }
};
