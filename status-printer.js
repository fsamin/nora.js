var table = require('easy-table');

var printer = function printResult (val, width) {
   if ( val == "Failed") {
      return '\033[31m' + String(val) + '\033[39m';
    } else if (val == "Passed") {
      return '\033[32m' + String(val) + '\033[39m';
    } else {
      return table.string(val);
    }
}

module.exports = printer;
