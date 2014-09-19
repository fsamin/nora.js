var fs = require('fs-extra');
var path = require('path');
var console = require('better-console');
var dom = require('xmldom').DOMParser;
var xpath = require('xpath');

/**
  Fonctions utilitaires
  */

var valuer = function setXMLProperties(xmlStream, namespaces, properties, debug, runDir) {
  var pattern = new RegExp(/\$\{.*\}/g);
  var arrMatches = xmlStream.match(pattern);

  if (arrMatches == null) {
    return xmlStream;
  } 
  
  //On va traiter les propriétés relatives à des références XPATH
  var xpathPattern = new RegExp(/\$\{.*:.*\}/g);
  var arrXpathMatches = xmlStream.match(xpathPattern);

  if (arrXpathMatches) {
    arrXpathMatches.forEach(function(match){
      var xmlID = match.trim().replace(/\$\{/, "").replace(/:.*\}/, "");
      if (debug) console.log("    * Found reference to " + xmlID + ", loading...");
      var xmlFilePath = runDir + path.sep + xmlID + ".xml";
      var xmlFile = fs.readFileSync(xmlFilePath, "utf8");
      var xpathStr = match.trim().replace(/\$\{(.*?):/, "").replace(/\}/, "");
      if (debug) console.log("    * Found xpath " + xpathStr + ", loading...");
      var doc = new dom().parseFromString(xmlFile);
      var select = xpath.useNamespaces(namespaces);
      var nodes = select(xpathStr, doc);
      var matchingValue = nodes[0].firstChild.nodeValue;
      if (debug) console.log("    * Found matching values : " + matchingValue);
      if (debug) console.log("    * Replacing " + match + " by " + matchingValue);
      xmlStream = xmlStream.replace(match, matchingValue);  
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
      xmlStream = xmlStream.replace(match, property.propertyValue);      
    }
  });
  return xmlStream;
}


module.exports = valuer;
