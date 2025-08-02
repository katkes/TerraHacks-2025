// var query = require('query-string').parse(window.location.search.substring(1));
var data = require('./data.json')
var graph = getGraphFromQueryString();
var renderGraph = require("ngraph.pixel");

renderGraph(graph, {
  container: document.querySelector('.container'),
  clearAlpha: 0.0
});

function getGraphFromQueryString(query) {
  var graphGenerators = require('ngraph.generators');
  var createGraph = graphGenerators.grid;
  return createGraph(10, 10, 10);
}

