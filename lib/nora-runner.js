var console = require('better-console');
var fs = require('fs-extra');
var path = require('path');
var moment = require('moment');
var jsonxml = require('jsontoxml');
var slugify = require('slugify');
var util = require('util');

var runner = require('./runner');

var nora = function(testcaseFile, runDir, debug, executionReport, properties) {
	var testcase = JSON.parse(fs.readFileSync(testcaseFile, 'utf8'));
	dir = path.resolve(path.dirname(testcaseFile));
	var className = testcase.package + "." + testcase.name

	runDir = runDir || path.join(dir, "runs" + path.sep + testcase.package + 
			path.sep + testcase.name  + 
			path.sep + moment().format("YYYYMMDD-HHmmss"));
	fs.mkdirsSync(runDir);

	properties = properties || [];
	executionReport = executionReport || [];


	console.info("# Loading %s.%s", testcase.package, testcase.name);
	console.info("# Running in %s", runDir);
    console.info("# Starting with properties : " + util.format(properties));
	
    testcaseObject = {
        className: className,
		debug: debug,
		dir : dir,
		runDir : runDir,
		properties : properties,
		executionReport : executionReport,
        criticalFailure : false,
        hasFailure : false
	}

	testcase.teststeps.forEach(doTestStep, testcaseObject);
    return testcaseObject;
}

/**
 Traitement principal itératif sur le flux JSON du cas de test
 */
function doTestStep(teststep, index, teststeps) {

    var runningTestStep = {
        className : this.className,
        index: index,
        debug: this.debug,
        dir: this.dir,
        runDir: this.runDir,
        teststep: teststep,
        properties: this.properties,
        status: "NotRun",
        time: -1,
        getJsonReport: function() {
            var report = null;
            if (this.status == "Passed") {
                report = [{
                    name:'testcase',
                    attrs:'name="' + this.teststep.stepName + '" classname="' + slugify(this.className  + '.' + this.teststep.stepID + "-"+ this.teststep.stepName) + '" time= "' + this.time + '"'
                }];
            } else if (this.status == "Failed") {
                 report = [
                    {
                        name:'testcase',
                        attrs:'name="' + this.teststep.stepName + '" classname="' + slugify(this.className  + '.' + this.teststep.stepID + "-" + this.teststep.stepName) + '" time= "' + this.time + '"',
                        children:[
                            {name:'failure',text:"<![CDATA["+this.console.stdout+"]]>",attrs:{message:(this.console.failureMessage).replace('<','#').replace('>','#')}}
                        ]
                    }
                ];
            } else {
                report = [
                    {
                        name:'testcase',
                        attrs:'name="' + this.teststep.stepName + '" classname="' + slugify(this.className  + '.' + this.teststep.stepID + "-" + this.teststep.stepName) + '" time= "' + this.time + '"',
                        children:[
                            {name:'failure',text:"<![CDATA[Not performed test]]>",attrs:{message:"Not performed test", type:"skipped"}}
                        ]
                    }
                ];

            }
            return report;
        },
        console:{
            failureMessage: null,
            stdout: null,
            log:function() {
                if (!this.stdout) this.stdout = "";
                if (arguments.length > 1) {
                    this.stdout += util.format(arguments) + "\n";
                    console.log(util.format(arguments));
                } else {
                    this.stdout += util.format(arguments[0]) + "\n";
                    console.log(util.format(arguments[0]));
                }
            },
            dir: function() {
                if (!this.stdout) this.stdout = "";
                this.stdout += util.inspect(arguments) + "\n";
                console.dir(arguments);
            },
            info:function() {
                if (!this.stdout) this.stdout = "";
                 if (arguments.length > 1) {
                    this.stdout += util.format(arguments) + "\n";
                    console.info(util.format(arguments));
                } else {
                    this.stdout += util.format(arguments[0]) + "\n";
                    console.info(util.format(arguments[0]));
                }
            },
            error:function() {
                if (!this.stdout) this.stdout = "";
                 if (arguments.length > 1) {
                    this.stdout += util.format(arguments) + "\n";
                    console.error(util.format(arguments));
                } else {
                    this.stdout += util.format(arguments[0]) + "\n";
                    console.error(util.format(arguments[0]));
                }
                this.failureMessage = util.format(arguments[0]);
            }
        }
    };

    if (!this.criticalFailure) {
        runner(runningTestStep, this.executionReport, this.debug);
    }

    this.executionReport.push(runningTestStep);

    if (runningTestStep.status != "Passed") {
        this.hasFailure = true;
        if(runningTestStep.teststep.stepOptions.critical) {
            runningTestStep.console.error("* Failure on critical teststep, following teststeps will be skipped.");
            this.criticalFailure = true;
        }
    }

}

module.exports = nora;
