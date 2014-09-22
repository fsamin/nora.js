var fs = require('fs-extra');
var path = require('path');
var console = require('better-console');
var dom = require('xmldom').DOMParser;
var xpath = require('xpath');
var jsonPath = require('JSONPath');

/**
  Fonctions utilitaires
  */

var valuer = function setProperties(stream, namespaces, properties, debug, runDir) {
  if (stream == null) {
    return stream;
  }

  var isString = (typeof stream == 'string');
  if (!isString) {
    stream = JSON.stringify(stream);
  }


  var pattern = new RegExp(/\$\{.*?\}/g);
  var arrMatches = stream.match(pattern);

  if (arrMatches == null) {
    if (!isString) {
        stream = JSON.parse(stream);
    }
    return stream;
  } 
  
  //On va traiter les propriétés relatives à des références XPATH
  var xpathPattern = new RegExp(/\$\{.*:xml:.*?\}/g);
  var arrXpathMatches = stream.match(xpathPattern);

  if (arrXpathMatches) {
    arrXpathMatches.forEach(function(match){
      var xmlID = match.trim().replace(/\$\{/, "").replace(/:xml:.*?\}/, "");
      if (debug) console.log("    * Found reference to " + xmlID + ", loading...");
      var xmlFilePath = runDir + path.sep + xmlID + ".xml";
      var xmlFile = fs.readFileSync(xmlFilePath, "utf8");
      var xpathStr = match.trim().replace(/\$\{(.*?):xml:/, "").replace(/\}/, "");
      if (debug) console.log("    * Found xpath " + xpathStr + ", loading...");
      var doc = new dom().parseFromString(xmlFile);
      var select = xpath.useNamespaces(namespaces);
      var nodes = select(xpathStr, doc);
      var matchingValue = nodes[0].firstChild.nodeValue;
      if (debug) console.log("    * Found matching values : " + matchingValue);
      if (debug) console.log("    * Replacing " + match + " by " + matchingValue);
      stream = stream.replace(match, matchingValue);
    });
  }

  //On va traiter les propriétés relatives à des références JSON
  var jsonPattern = new RegExp(/\$\{.*:json:.*?\}/g);
  var arrJsonMatches = stream.match(jsonPattern);

  if (arrJsonMatches) {
    arrJsonMatches.forEach(function(match){
        var jsonID = match.trim().replace(/\$\{/, "").replace(/:json:.*?\}/, "");
        if (debug) console.log("    * Found reference to " + jsonID + ", loading...");
        var jsonFilePath = runDir + path.sep + jsonID + ".json";
        var jsonFile = fs.readFileSync(jsonFilePath, "utf8");
        var jsonMatchStr = match.trim().replace(/\$\{(.*?):json:/, "").replace(/\}/, "");
        if (debug) console.log("    * Found json " + jsonMatchStr + ", loading...");
        var jsonObject = JSON.parse(jsonFile);
        var matchingValue = jsonPath.eval(jsonObject,jsonMatchStr);
        if (matchingValue) {
            if (debug) console.log("    * Found matching values : " + matchingValue);
            if (debug) console.log("    * Replacing " + match + " by " + matchingValue);
            stream = stream.replace(match, matchingValue);
        } else {
            if (debug) console.log("    * Matching values  not found : " + jsonMatchStr);

        }

    });
  }

  arrMatches.forEach(function(match){
    var propertyName = match.trim().replace(/\$\{/, "").replace(/\}/, "");
    var found = false;
    var property;
    properties.forEach(function(p) {
      if (p.propertyName == propertyName) {
        found = true; 
        property = p;
      }
    });
    if (found) {
      if (debug) console.log("  * Replacing " + property.propertyName + " by " + property.propertyValue);
      stream = stream.replace(match, property.propertyValue);
    }
  });

  if (!isString) {
    stream = JSON.parse(stream);
  }
  return stream;
}


module.exports = valuer;
