var console = require('better-console');
var request = require('request');
var httpsync = require('httpsync');
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
var requests = [];
var responses = [];
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
      status = doStepLoadProperties(teststep, properties);
      break;
    case "makeRequest" :
      status = doStepMakeRequest(teststep, properties);
      break;
    case "sendRequest" :
      status = doStepSendRequest(teststep, properties);
      break;
    case "checkXML" :
      status = doStepCheckXML(teststep, properties);
      break;
    default:
      console.error("* Unrecognize stepAction %j", teststep.stepAction);
      status = "failed";
  }
  result.push({id : index, step : teststep.stepName, result: status});
}

/**
  Traitement chargement de propriété
  */
function doStepLoadProperties(teststep, properties) {
  console.log("* " + teststep.stepID  + " - " + teststep.stepName);
  var filename = path.join(path.join(__dirname, program.testcase), "..") + path.sep + teststep.stepOptions.filename;
  console.log("  * Loading properties " + filename);

  try {
    if (!fs.existsSync(filename)) {
      console.error("  * %j is not a file", filename);
      throw new Error('%j is not a file', filename)
    }
    JSON.parse(fs.readFileSync(filename, 'utf8'))
      .forEach(function(value) {
        properties.push(value);
    });
  } catch (err) {
    console.error("  * Error while parsing %j", filename);
    throw err
  }
  return "Passed";
}

/**
  Traitement de préparation de requête
  */
function doStepMakeRequest(teststep, properties) {
  console.log("* " + teststep.stepID  + " - " + teststep.stepName);
  var template = path.join(path.join(__dirname, program.testcase), "..") + path.sep + teststep.stepOptions.requestTemplate;
  console.log("  * Loading Request Template " + template);
  try {
    var request = fs.readFileSync(template, "utf8");
    request = setXMLProperties(request, properties);
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
function doStepSendRequest(teststep, properties) {
  console.log("* " + teststep.stepID  + " - " + teststep.stepName);
  var requestFilePath = runDir + path.sep + teststep.stepOptions.requestID + ".xml";
  var requestFile = fs.readFileSync(requestFilePath, "utf8");

  var req = httpsync.request({
    url: teststep.stepOptions.url,
    method: "POST",
    useragent: "Nora.js",
    headers: {
      'SOAPAction': teststep.stepOptions.SOAPAction,
      'Content-Type' : 'text/xml; charset="utf-8"'
    }
  });
  console.log("  * Sending request to " + teststep.stepOptions.url);
  req.write(requestFile);
  response = req.end();

  console.log("  * HTTP-Status:" + response.statusCode + ", from " + response.ip);
  var responseFile = response.data.toString();

  if (response.statusCode != 200) {
    console.error();
    console.dir(response);
    console.dir(responseFile)
    //if (teststep.stepOptions.stopOnError) {
    //  return "STOP";
    //}
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
function doStepCheckXML(teststep, properties) {
  console.log("* " + teststep.stepID  + " - " + teststep.stepName);
  var xmlPath = runDir + path.sep + teststep.stepOptions.xmlID + ".xml";
  var xmlFile = fs.readFileSync(xmlPath, "utf8");
  var result = true;

  teststep.stepOptions.asserts.forEach(function(myAssert){
    switch(myAssert.type) {
      case "contains" :
        var tmpResult = (xmlFile.indexOf(myAssert.value) > -1);
        result  = result && tmpResult;
        console.log("  * " + myAssert.type  + " - " + myAssert.value + " : " + tmpResult);
        break;
      case "notContains" :
        var tmpResult = (xmlFile.indexOf(myAssert.value) == -1);
        result  = result && tmpResult;
        console.log("  * " + myAssert.type  + " - " + myAssert.value + " : " + tmpResult);
        break;
      case "xpath" :
        var tmpResult = false;
        try {
          var doc = new dom().parseFromString(xmlFile);
          var select = xpath.useNamespaces(myAssert.namespaces);
          var nodes = select(myAssert.xpath, doc);
          if (myAssert.match ==  nodes[0].firstChild.nodeValue) {
            tmpResult = true;
          } 
        } catch (err) {
          console.error(err);
          tmpResult = false;
        }
        result  = result && tmpResult;
        console.log("  * " + myAssert.type  + " - " + myAssert.xpath + " - " + myAssert.match + " : " + tmpResult);
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

function setXMLProperties(xmlStream, properties) {
  var pattern = new RegExp(/\$\{.*\}/);
  var arrMatches = xmlStream.match(pattern);

  if (arrMatches == null) {
    console.log("    * no property found ");
    return xmlStream;
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
