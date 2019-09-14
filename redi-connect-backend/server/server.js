'use strict';

var loopback = require('loopback');
var boot = require('loopback-boot');

var http = require('http');
var https = require('https');
var sslConfig = require('./ssl-config');

var app = (module.exports = loopback());

require('../lib/email');

app.start = function() {
  // start the web server
  return app.listen(function() {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};

// Inject current user into context
app
  .remotes()
  .phases.addBefore('invoke', 'options-from-request')
  .use(function(ctx, next) {
    if (!ctx.args || !ctx.args.options || !ctx.args.options.accessToken)
      return next();
    const RedUser = app.models.RedUser;
    RedUser.findById(
      ctx.args.options.accessToken.userId,
      { include: 'redProfile' },
      function(err, user) {
        if (err) return next(err);
        ctx.args.options.currentUser = user.toJSON();
        next();
      }
    );
  });

app.use(
  '/api/s3',
  require('react-s3-uploader/s3router')({
    bucket: 'redi-connect-profile-avatars',
    region: 'eu-west-1', // optional
    signatureVersion: 'v4', // optional (use for some amazon regions: frankfurt and others)
    headers: { 'Access-Control-Allow-Origin': '*' }, // optional
    ACL: 'public-read', // this is default
    uniquePrefix: true, // (4.0.2 and above) default is true, setting the attribute to false preserves the original filename in S3
  })
);

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname);

app.start = function(httpOnly) {
  if (httpOnly === undefined) {
    httpOnly = process.env.HTTP;
  }
  var server = null;
  if (!httpOnly) {
    var options = {
      key: sslConfig.privateKey,
      cert: sslConfig.certificate,
    };
    server = https.createServer(options, app);
  } else {
    server = http.createServer(app);
  }
  server.listen(app.get('port'), function() {
    var baseUrl =
      (httpOnly ? 'http://' : 'https://') +
      app.get('host') +
      ':' +
      app.get('port');
    app.emit('started', baseUrl);
    console.log('LoopBack server listening @ %s%s', baseUrl, '/');
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
  return server;
};

// start the server if `$ node server.js`
if (require.main === module) {
  app.start();
}
