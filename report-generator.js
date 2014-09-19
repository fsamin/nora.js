var builder = require('xmlbuilder');
var fs = require("fs");


/**
  Génération du report
  */
var report = function generateReport(results,testcase,nbKo,fileReport) {
	console.log("Génération du rapport pour le testcase: "+testcase);
	
	// Element TestSuite
	var xml = builder.create('testsuite').att({'name':testcase,'time': '','tests': results.length,'errors': '0','skipped': '0','failures': nbKo});
	
	// Elements TestCases
	results.forEach(function (res) {
		if(res.result!="Passed"){
			generationTestCase(xml,res.step,testcase).ele('failure',{'message':'Erreur lors du test......'},'ici la stack trace');
		} else {
			generationTestCase(xml,res.step,testcase)
		}		
		xml.end({ pretty: true});
	});	

	fs.writeFileSync(fileReport, xml, "UTF-8");
}

// Generation balise testcase
function generationTestCase(xml,step,pack){
	// 
	return xml.ele('testcase', {'name': step.stepName,'classname': pack+"."+step.stepID+"-"+step.stepName,'time': ''});
}

module.exports = report;
	

