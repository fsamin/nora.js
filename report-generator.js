var jsonxml = require('jsontoxml');
var fs = require('fs-extra');
var path = require('path');


/**
  Génération du report
  */
var report = function generateReport(executionReport,testcase) {
	console.log("Génération du rapport pour le testcase: "+testcase);
	
	// calcul du nombre de KO
	var nbKo = 0;
	executionReport.forEach(function (res) {
		if(res.result != 'Passed'){
			nbKo++;
		}
	});
	
	// Creation testsuite
	var report = [{
		name:'testsuite',
        attrs:'name="' + testcase + '" errors="'+nbKo +'" tests="'+executionReport.length+'"',
		children:[]
     }];
	 
	 // Creation Report
	 executionReport.forEach(function (res) {
		report[0].children.push(res.getJsonReport()[0]);
	 });	
	
	// Ecriture du fichier dans le repertoire de sortie
	var runDir = executionReport[0].runDir;
	fs.writeFileSync(runDir  + path.sep + "report.xml", jsonxml(report), "utf8", function(err) {
		if(err) {
			runningTestStep.console.error(err);
	        throw err;
	    } 
	}); 
}

module.exports = report;
	

