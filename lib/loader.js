var fs = require('fs-extra');
var path = require('path');
var setXMLProperties = require(__dirname + path.sep + "request-valuer.js", "utf8");

/**
  Traitement chargement de propriété
  */
var loader = function doStepLoadProperties(runningTestStep) {
  runningTestStep.console.log("* " + runningTestStep.teststep.stepID  + " - " + runningTestStep.teststep.stepName);
  runningTestStep.teststep.stepOptions.forEach(function(stepOption){
    if (stepOption.filename === null
      && stepOption.generator === null && runningTestStep.properties.length === 0) {
      runningTestStep.console.error("Error parsing " + runningTestStep.teststep.stepID + " options.\n filename or generator, is mandatory.\nPlease correct your json testcase before relaunch nora.js.");
      runningTestStep.console.dir(runningTestStep.teststep);
      throw new Error("Malformated loadProperty test step");
    }


    if (stepOption.filename != null) {
      var filename = runningTestStep.dir + path.sep + stepOption.filename;
      runningTestStep.console.log("  * Loading properties " + filename);

      try {
        if (!fs.existsSync(filename)) {
          runningTestStep.console.error("  * %j is not a file", filename);
          throw new Error('this is not a file');
        }
        JSON.parse(fs.readFileSync(filename, 'utf8'))
          .forEach(function(value) {
            runningTestStep.properties.push(value);
        });
      } catch (err) {
        runningTestStep.console.error("  * Error while parsing %j", filename);
        throw err;
      }
    } else if (stepOption.generator != null) {
      //On vérifie si le générateur a des options
      var args;
      var argsV = [];
      var filename;
      console.dir(stepOption.generator);
      if (stepOption.generator.trim().indexOf(" ") != -1) {
        args = stepOption.generator.trim().split(" ").slice(1);
        args.forEach(function(arg) {
          argsV.push(setXMLProperties(runningTestStep, arg, undefined, runningTestStep.properties, runningTestStep.debug));
        });
        console.dir(argsV);
        filename  = stepOption.generator.trim().split(" ")[0];
      } else {
        filename = stepOption.generator;
      }

      filename = runningTestStep.dir + path.sep + filename;
      runningTestStep.console.log("  * Loading properties generator " + filename + "(" + argsV  +  ")");
      if (!fs.existsSync(filename)) {
        runningTestStep.console.error("  * Cannot find generator %j", filename);
        throw new Error('Cannot find generator');
      }
      var generator = require(filename, 'utf8');
      generator(argsV).forEach(function(value) {
          runningTestStep.properties.push(value);
      });
      

    }
  });
  return "Passed";
}

module.exports = loader;