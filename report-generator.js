var jsonxml = require('jsontoxml');
var fs = require("fs");


/**
  Génération du report
  */
var report = function generateReport(executionReport,testcase,fileReport) {
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
	
	fs.writeFileSync(fileReport, jsonxml(report), "UTF-8");
}

module.exports = report;
	

