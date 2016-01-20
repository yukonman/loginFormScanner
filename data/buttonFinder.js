debugger;

//use universal javascript. keyword "javascript timeout" 

var login_regexes = /(log[\s-_]?[io]n)|(sign[\s-_]?[io]n)/gi
var shopping_regexes = /(shop(ping)?)|(cart)/gi

var filteredElements;
var preTranslatedFiltered; 

self.port.emit("IhaveLoaded", "I am buttonFinder.js");

self.port.emit("siteURL",document.URL)

self.port.on("startClickingOnSecond", function(notes) {
	console.log("second"); 
	 
	//function second()
});

//find all things that look like login
self.port.on("findRelevantElements", function(message) {
	var relevantElements = findAllElements()
	self.port.emit("hereAreRelevantElements", relevantElements)
	console.log(message)
});

self.port.on("clickElement", function(element) {
	//var rect = preTranslatedFiltered[element].getBoundingClientRect()
	//console.log(rect.top, rect.right, rect.bottom, rect.left);
	//preTranslatedFiltered[element].style.background = 'green'
	preTranslatedFiltered[element].click()

});

//detect page click (it's difficult to detect DOM change because JavaScript changes the DOM, and your HTML stays the same)
//instead, you could detect a DOM change by listening for a click
//this piece of code is always "listening" and will activate on click
$(document).ready(function() {
   	// Your code here
   	document.body.addEventListener("click", function() {
		console.log("page clicked")
	});
});


function findAllElements() {
	var elements = document.getElementsByTagName("*")
	filteredElements = filterRelevantelements(elements)
	return filteredElements
}

function filterRelevantelements(elements) {
	var relevantElements = []
	preTranslatedFiltered = []
	for (var i = 0; i < elements.length; i++) {
		var curElement = translateElement(elements[i])
		for (attribute in curElement) {
			var value = curElement[attribute]
			if (value.match(login_regexes) != null | value.match(shopping_regexes) != null) { //there was a match
				relevantElements.push(curElement)
				preTranslatedFiltered.push(elements[i])
				break
			}
		}
	}
	return relevantElements
}


/** helper function **/
function translateElement(element){
	var result = {}
	if (element == null | element == undefined)
		return result
	var allAttributes = element.attributes 
	for (var i = 0; i < allAttributes.length; i++) {
		result[allAttributes[i].name] = allAttributes[i].value
	}
	
	if (element.innerHTML.length > 15) {
		result["innerHTML"] = ""
	}
	else {
		result["innerHTML"] = element.innerHTML
	}
	
	return result
}
