'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const _ = require('lodash');
const ejs = require('ejs');
const jsonfile = require('jsonfile');
const Q = require('q');
const mkdirp = require('mkdirp');

const TEMPLATE_PATH = path.join(__dirname, 'templates')
const DOMAIN_TEMPLATE = path.join(TEMPLATE_PATH, '_domain.conf');
const SSL_DOMAIN_TEMPLATE = path.join(TEMPLATE_PATH, '_ssl-domain.conf');
const SSL_PARAMS_TEMPLATE = path.join(TEMPLATE_PATH, '_ssl-params.conf');
const SNIPPETS_FOLDER = 'snippets';
const SSL_PARAMS_FILENAME = 'ssl-params.conf';

const DEFAULT_OPTIONS = {
  config: path.join(os.homedir(), '.nginxconf'),
  nginxDirectory: '/etc/nginx',
  confName: 'ngxconf.conf'
}

let options;

function fileExists(filename) {
  return new Promise((resolve, reject) => {
    fs.stat(filename, (err, stat) => {
      if (err) {
        reject(err);
        return;
      }
      let exists = stat.isFile();
      if (exists) {
        resolve(filename);
      } else {
        reject({message: 'NO CONFIG FILE!'});
      }
    })
  });
}

function loadConfig(configPath) {
  return new Promise((resolve, reject) => {
    jsonfile.readFile(configPath, (err, config) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(config);
    });
  });
}

function writeSslParamsSnippets(config) {
  return new Promise((resolve, reject) => {
    let targetPath = path.join(options.nginxDirectory, SNIPPETS_FOLDER, SSL_PARAMS_FILENAME);
    ejs.renderFile(SSL_PARAMS_TEMPLATE, config, (err, str) => {
      if (err) {
        reject(err);
        return;
      }

      fs.writeFile(targetPath, str, 'utf8', (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(config);
      })
    });
  });
}

function writeSslDomains(config) {
  let snippetsFolder = path.join(options.nginxDirectory, SNIPPETS_FOLDER);
  return Promise.all(Object.keys(config.ssl).map((sslName) => {
    return new Promise((resolve, reject) => {
      let fileName = 'ssl-' + sslName + '.conf';
      let targetPath = path.join(snippetsFolder, fileName);
      ejs.renderFile(SSL_DOMAIN_TEMPLATE, { domain: config.ssl[sslName].certDomain }, (err, str) => {
        if (err) {
          reject(err);
          return;
        }

        fs.writeFile(targetPath, str, 'utf8', (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          resolve(config);
        });
      });
    });
  })).then(() => config);
}

function writeHostsFile(config) {
  return new Promise((resolve, reject) => {
    let targetPath = path.join(options.nginxDirectory, 'conf.d', options.confName);
    ejs.renderFile(DOMAIN_TEMPLATE, config, (err, str) => {
      if (err) {
        reject(err);
        return;
      }

      fs.writeFile(targetPath, str, 'utf8', (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(targetPath);
      });
    });
  });
}

function createFolders(config) {
  let confFolder = path.join(options.nginxDirectory, 'conf.d');
  let snippetsFolder = path.join(options.nginxDirectory, SNIPPETS_FOLDER);

  return new Promise((resolve, reject) => {
    mkdirp(confFolder, (err) => {
      if (err) {
        reject(err);
        return;
      }

      mkdirp(snippetsFolder, (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(config);
      })
    })
  })
}

function generateConfig(opt) {
  options = _.defaults(opt, DEFAULT_OPTIONS);
  return fileExists(opt.config)
    .then(loadConfig)
    .then(createFolders)
    .then(writeSslParamsSnippets)
    .then(writeSslDomains)
    .then(writeHostsFile)
}

module.exports = generateConfig;