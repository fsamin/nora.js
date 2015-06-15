var fs = require('fs');
var parse = require('csv-parse');
var delim = ';'

/**
* Use to parse an input stream, and send the result object to a function given in parameter
*/
var parserProperties = function(callback) {
    return parse({delimiter: delim,trim : true}, function(err, data){

       var res = [];
       var columns = [];
        // the first line defines the name of the columns. The other lines are used to get the different properties
        columns = data[0];
        for (var i=1;i<data.length;i++) {
            var line = data[i];
            var propLine = [];
            // for each column, a result propertyName/propertyValue is stored
            columns.forEach(function (column, index) {
                var prop = [];
                prop = {propertyName:column, propertyValue:line[index]};
                propLine[index] = prop;
            });
            // The line has been parsed, the result can be stored.
            res[i-1] = propLine;
        }
        callback(res);
       });
    }

module.exports = parserProperties;