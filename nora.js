var console = require('better-console');
var request = require('request');
//var httpsync = require('httpsync');
var httpsync;
try {
  httpsync = require('http-sync');
} catch (ex) {
  httpsync = require('http-sync-win');
}
var fs = require('fs-extra');
var path = require('path');
var program = require('commander');
var moment = require('moment');
var table = require('easy-table');
var xpath = require('xpath')
var dom = require('xmldom').DOMParser;
var pd = require('pretty-data').pd;

program
  .version('0.0.1')
  .option('-t, --testcase [filename]', 'set the testcase', 'tests/getWeatherTest/getWeatherTestCase.json')
  .parse(process.argv);

var runDir = path.join(__dirname, "runs" + path.sep + path.basename(program.testcase, ".json") + path.sep +  moment().format("YYYYMMDD-HHmmss"));
fs.mkdirsSync(runDir);

console.info("Loading %j", program.testcase);

var testcase = JSON.parse(fs.readFileSync(program.testcase, 'utf8'));

var properties = [];
var result = [];

testcase.forEach(doTestStep);

var t = new table();

result.forEach(function (res) {
    t.cell('Id', res.id);
    t.cell('Description', res.step);
    t.cell('Result', res.result, printResult);
    t.newRow();
});

console.info("TestCase %j Report", program.testcase);
console.log(t.toString());

/**
  Traitement principal itératif sur le flux JSON du cas de test
  */
function doTestStep(teststep, index, testcase) {
  var status;
  switch(teststep.stepAction) {
    case "loadProperty" :
      status = doStepLoadProperties(teststep);
      break;
    case "makeRequest" :
      status = doStepMakeRequest(teststep);
      break;
    case "sendRequest" :
      status = doStepSendRequest(teststep);
      break;
    case "checkXML" :
      status = doStepCheckXML(teststep);
      break;
    default:
      console.error("* Unrecognize stepAction %j", teststep.stepAction);
      console.dir(teststep);
      status = "failed";
  }
  result.push({id : index, step : teststep.stepName, result: status});
}

/**
  Traitement chargement de propriété
  */
function doStepLoadProperties(teststep) {
  console.log("* " + teststep.stepID  + " - " + teststep.stepName);
    
  if (teststep.stepOptions.filename == null
    && teststep.stepOptions.generator == null) {
    console.error("Error parsing " + teststep.stepID + " options.\n filename or generator, is mandatory.\nPlease correct your json testcase before relaunch nora.js.");
    console.dir(teststep);
    throw new Error("Malformated loadProperty test step");
  }

  if (teststep.stepOptions.filename != null) {
    var filename = path.join(path.join(__dirname, program.testcase), "..") + path.sep + teststep.stepOptions.filename;
    console.log("  * Loading properties " + filename);

    try {
      if (!fs.existsSync(filename)) {
        console.error("  * %j is not a file", filename);
        throw new Error('this is not a file')
      }
      JSON.parse(fs.readFileSync(filename, 'utf8'))
        .forEach(function(value) {
          properties.push(value);
      });
    } catch (err) {
      console.error("  * Error while parsing %j", filename);
      throw err
    }
  } else if (teststep.stepOptions.generator != null) {
    var filename = path.join(path.join(__dirname, program.testcase), "..") + path.sep + teststep.stepOptions.generator;
    console.log("  * Loading properties generator " + filename);
    if (!fs.existsSync(filename)) {
      console.error("  * Cannot find generator %j", filename);
      throw new Error('Cannot find generator')
    }
    var generator = require(filename, 'utf8');
    generator().forEach(function(value) {
          properties.push(value);
      });

  }
  return "Passed";
}

/**
  Traitement de préparation de requête
  */
function doStepMakeRequest(teststep) {
  console.log("* " + teststep.stepID  + " - " + teststep.stepName);
  
  if (teststep.stepOptions.requestID == null || 
    teststep.stepOptions.requestTemplate == null 
    ) {
    console.error("Error parsing " + teststep.stepID + " options.\n requestID, requestTemplate are mandatory.\nPlease correct your json testcase before relaunch nora.js.");
    console.dir(teststep);
    throw new Error("Malformated makeRequest test step");
  }

  var template = path.join(path.join(__dirname, program.testcase), "..") + path.sep + teststep.stepOptions.requestTemplate;
  console.log("  * Loading Request Template " + template);
  try {
    var request = fs.readFileSync(template, "utf8");
    request = setXMLProperties(request);
    console.log("  * Saving Request " + teststep.stepOptions.requestID + ".xml");
    fs.writeFileSync(runDir  + path.sep + teststep.stepOptions.requestID+".xml", pd.xml(request), "utf8", function(err) {
        if(err) {
            console.error(err);
            throw err;
        } 
    }); 
  } catch (err) {
    console.error("  * Error while parsing %j", template);
    throw err
  }
  return "Passed";
}

/**
  Traitement d'envoi de la requête synchrone et de sauvegarde de la réponse
  */
function doStepSendRequest(teststep) {
  console.log("* " + teststep.stepID  + " - " + teststep.stepName);

  if (teststep.stepOptions.requestID == null || 
    teststep.stepOptions.protocol == null ||
    teststep.stepOptions.host == null ||
    teststep.stepOptions.port == null ||
    teststep.stepOptions.path == null ||
    teststep.stepOptions.SOAPAction == null ||
    teststep.stepOptions.responseID == null
    ) {
    console.error("Error parsing " + teststep.stepID + " options.\n requestID, protocol, host, port, path and SOAPAction and responseID are mandatory.\nPlease correct your json testcase before relaunch nora.js.");
    console.dir(teststep);
    throw new Error("Malformated sendRequest test step");
  }

  var requestFilePath = runDir + path.sep + teststep.stepOptions.requestID + ".xml";
  
  if (!fs.existsSync(requestFilePath)) {
      console.error("  * Cannot find XML %j", requestFilePath);
      throw new Error('Cannot find XML');
  }

  var requestFile = fs.readFileSync(requestFilePath, "utf8");

  var req = httpsync.request({
    host: teststep.stepOptions.host,
    port: teststep.stepOptions.port,
    path: teststep.stepOptions.path,
    protocol: teststep.stepOptions.protocol,
    method: "POST",
    useragent: "Nora.js",
    headers: {
      'SOAPAction': teststep.stepOptions.SOAPAction,
      'Content-Type' : 'text/xml; charset="utf-8"'
    }
  });
  console.log("  * Sending request to " + teststep.stepOptions.protocol + "://" + teststep.stepOptions.host + ":" + teststep.stepOptions.port + teststep.stepOptions.path);
  req.write(requestFile);
  response = req.end();

  console.log("  * HTTP-Status:" + response.statusCode);
  var responseFile = response.body.toString();

  if (response.statusCode != 200) {
    console.error("   * Error " + response.statusCode + " send by server. See detail below.");
    console.dir(response);
    console.dir(responseFile)
    return "Failed";
  } else {
    var responseFilePath = runDir + path.sep + teststep.stepOptions.responseID + ".xml";
    console.log("  * Saving Response " + teststep.stepOptions.responseID + ".xml");
    fs.writeFileSync(responseFilePath, pd.xml(responseFile), "utf8", function(err) {
        if(err) {
            console.error(err);
            throw err;
        } 
    }); 
  }
  return "Passed";
}

/**
  Traitement de vérification de trames
  */
function doStepCheckXML(teststep) {
  console.log("* " + teststep.stepID  + " - " + teststep.stepName);
  
  if (teststep.stepOptions.xmlID == null || 
    teststep.stepOptions.asserts == null
    ) {
    console.error("Error parsing " + teststep.stepID + " options.\n xmlID, asserts are mandatory.\nPlease correct your json testcase before relaunch nora.js.");
    console.dir(teststep);
    throw new Error("Malformated sendRequest test step");
  }

  var xmlPath = runDir + path.sep + teststep.stepOptions.xmlID + ".xml";

  if (!fs.existsSync(xmlPath)) {
      console.error("  * Cannot find XML %j", xmlPath);
      throw new Error('Cannot find XML');
  }

  var xmlFile = fs.readFileSync(xmlPath, "utf8");
  var result = true;

  teststep.stepOptions.asserts.forEach(function(myAssert){

    if (myAssert.type == null) {
      console.error("Error parsing assertion.\n type is mandatory.\nPlease correct your json testcase before relaunch nora.js.");
      console.dir(myAssert);
      throw new Error("Malformated assertion test step");
    }

    switch(myAssert.type) {
      case "contains" :
        if (myAssert.value == null) {
          console.error("Error parsing assertion.\n value is mandatory.\nPlease correct your json testcase before relaunch nora.js.");
          console.dir(myAssert);
          throw new Error("Malformated assertion test step");
        }

        var tmpResult = (xmlFile.indexOf(myAssert.value) > -1);
        result  = result && tmpResult;
        console.log("  * " + myAssert.type  + " - " + myAssert.value + " : " + tmpResult);
        break;
      case "notContains" :
        if (myAssert.value == null) {
          console.error("Error parsing assertion.\n value is mandatory.\nPlease correct your json testcase before relaunch nora.js.");
          console.dir(myAssert);
          throw new Error("Malformated assertion test step");
        }

        var tmpResult = (xmlFile.indexOf(myAssert.value) == -1);
        result  = result && tmpResult;
        console.log("  * " + myAssert.type  + " - " + myAssert.value + " : " + tmpResult);
        break;
      case "xpath" :
        if (myAssert.xpath == null || myAssert.match == null) {
          console.error("Error parsing assertion.\n xpath and match are mandatory.\nPlease correct your json testcase before relaunch nora.js.");
          console.dir(myAssert);
          throw new Error("Malformated assertion test step");
        }

        var tmpResult = false;
        try {
          var doc = new dom().parseFromString(xmlFile);
          var select = xpath.useNamespaces(myAssert.namespaces);
          var nodes = select(myAssert.xpath, doc);
          var match = setXMLProperties(myAssert.match, myAssert.matchNamespaces);
          if (match ==  nodes[0].firstChild.nodeValue) {
            tmpResult = true;
          } 
        } catch (err) {
          console.error(err);
          tmpResult = false;
        }
        result  = result && tmpResult;
        console.log("  * " + myAssert.type  + " - " + myAssert.match + " : " + tmpResult);
        break;
      default:
        console.error("* Unrecognize assert type %j", myAssert.type);
        return "Failed";
    }
  });
  if (result) 
    return "Passed";
  else
    return "Failed";

}

/**
  Fonctions utilitaires
  */

function setXMLProperties(xmlStream, namespaces) {
  var pattern = new RegExp(/\$\{.*\}/);
  var arrMatches = xmlStream.match(pattern);

  if (arrMatches == null) {
    return xmlStream;
  } 
  
  //On va traiter les propriétés relatives à des références XPATH
  var xpathPattern = new RegExp(/\$\{.*:.*\}/);
  var arrXpathMatches = xmlStream.match(xpathPattern);

  if (arrXpathMatches != null) {
    arrXpathMatches.forEach(function(match){
      var xmlID = match.trim().replace(/\$\{/, "").replace(/:.*\}/, "");
      console.log("    * Found reference to " + xmlID + ", loading...");
      var xmlFilePath = runDir + path.sep + xmlID + ".xml";
      var xmlFile = fs.readFileSync(xmlFilePath, "utf8");
      var xpathStr = match.trim().replace(/\$\{(.*?):/, "").replace(/\}/, "");
      console.log("    * Found xpath " + xpathStr + ", loading...");
      var doc = new dom().parseFromString(xmlFile);
      var select = xpath.useNamespaces(namespaces);
      var nodes = select(xpathStr, doc);
      var matchingValue = nodes[0].firstChild.nodeValue;
      console.log("    * Found matching values : " + matchingValue);
      console.log("    * Replacing " + match + " by " + matchingValue);
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
      console.log("  * Replacing " + property.propertyName + " by " + property.propertyValue);
      xmlStream = xmlStream.replace(match, property.propertyValue);      
    }
  });
  return xmlStream;
}

function printResult (val, width) {
   if ( val == "Failed") {
      return '\033[31m' + String(val) + '\033[39m';
    } else {
      return table.string(val);
    }
}
