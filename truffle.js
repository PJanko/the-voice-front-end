module.exports = {
  build: {
    "index.html": "index.html",
    "home.html": "home.html",
    "singer.html": "singer.html",
    
    "app.js": [
      "js/vendors/jquery.min.js",
      "js/vendors/angular.min.js",
      "js/vendors/angular-route.min.js",
      "js/vendors/jquery.dropotron.min.js",
      "js/vendors/skel.min.js",
      "js/vendors/util.js",
      "js/vendors/main.js",
      "js/app.js",
      "js/controllers/homecontroller.js",
      "js/controllers/singercontroller.js"
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
