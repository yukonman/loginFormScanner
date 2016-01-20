var login_regexes = /(log[\s-_]?[io]n)|(sign[\s-_]?[io]n)/gi
var username_regexes = /(?:e[\s-_]?mail)|(user[\s-_]?name)|((log|sign)[\s-_]?in)|(log[\s-_]?[io]n[\s-_]?id)|(user[\s-_]?id)|(mobile[\s-_]?phone)|(phone[\s-_]?number)|(tele[\s-_]?phone)|(phone)|(id)|(account)|(acct)|(uname)|(mobile)/gi
var password_regexes = /(pass[\s-_]?word)|(pass[\s-_]code)|(secret[\s-_]?code)|(secret[\s-_]pass)|(secret)|(pass)|(code)|(passwd)|(pswd)/gi
var submit_regexes = /submit|enter|(log[\s-_]?[io]n)|(sign[\s-_]?[io]n)/gi //add more to this later!
var submit_only_regexes = /submit|enter/gi

$(document).ready(function() {
	self.port.emit("IHaveLoaded", document.URL); 
}); 

var dummyUsername = "dummyUserName@gmail.com"
var dummyPassword = "dummyPassword"
var currentDOM = ""
var currentURL = ""

var translatedForms; 
var passwordForms; 
var passwordElementsInfo = {}
var passwordElements = []


function getAllForms() {
	return document.forms
}

/**
function isNewDOM() {
	var newDOM = document.body
	return (newDOM != currentDOM)
}
**/

function getPageInfo() {
	currentDOM = document.body
	currentURL = document.URL
}

/**find login separate elements functions **/

function checkForLoginElements() {
	console.log("checkForLoginElements")
	var allElements = findAllElements()
	
	//stop if there aren't any elements
	if (allElements.length == 0) {
		console.log("There aren't any elements on the page")
		self.port.emit("noPossibleElementsOnPage", "")
	}
	
	//check to see if there are password fields
	var foundPassword = 0
	passwordElements = []
	
	for (var i = 0; i < allElements.length; i++) {
		if (allElements[i] != null & allElements[i] != undefined) {
			if (isPasswordField(allElements[i])) {
				var rect = allElements[i].getBoundingClientRect()
				if (!(rect.top == 0 & rect.right == 0 & rect.bottom == 0 & rect.left == 0)) { //filter out elements that aren't visible
					passwordElements.push(allElements[i])
					foundPassword ++
				}
			}
		}
	}
	
	console.log("Number of password fields: " + foundPassword)
	
	if (foundPassword == 0){
		console.log("No Password field found")
		self.port.emit("noPossibleElementsOnPage", "")
	}
	else {
		var result = findSurroundingElements(passwordElements)
		if (result ==  0) {
			console.log("No Password field found")
			self.port.emit("noPossibleElementsOnPage", "")		
		}
		else {
			var translatedPasswordElementsInfo = {}
			for (eachPassword in passwordElementsInfo) {
				translatedPasswordElementsInfo[eachPassword] = translateElements(passwordElementsInfo[eachPassword])
			}
			self.port.emit("foundPasswordandSurroundingElements", translatedPasswordElementsInfo)
		}
		
	}
}

function findSurroundingElements(elements) {
	//Set how big of an area
	var above = 100 //for username
	var below = 100 //for submit
	
	var left = 100 //for username
	var right = 100 //for submit
	
	
	if (elements.length == 0) {
		return 0
	}
	var allElements = findAllElements()
	for (var i = 0; i < elements.length; i++) {

		var rect = elements[i].getBoundingClientRect();
		//console.log(rect.top, rect.right, rect.bottom, rect.left);
		var possibleSurroundElements = []
		for (var j = 0; j < allElements.length; j++) {
			//exclude hidden ones
			if (allElements[j].type != "hidden") {
				var elementRect = allElements[j].getBoundingClientRect()
				var topBottom = Math.abs(elementRect.top - rect.top)
				var leftRight = Math.abs(elementRect.left - rect.left)
				if ((topBottom < above) & (leftRight < left)) {
					possibleSurroundElements.push(allElements[j])
				}
			}
		}
		passwordElementsInfo[i] = possibleSurroundElements
	}
	return true

}


function autofillIndividualElements(message) {
	console.log("autofillIndividualElements()")
	console.log(message)
	var PWIndex = message["PWIndex"]
	var usernameIndex = message["usernameIndex"]
	var submitIndex = message["submitIndex"]
	
	turnOnAutocomplete(passwordElements[PWIndex])
	turnOnAutocomplete(passwordElementsInfo[PWIndex][usernameIndex])
	
	passwordElementsInfo[PWIndex][usernameIndex].value = dummyUsername
	passwordElements[PWIndex].value = dummyPassword
	
	submitButton(passwordElementsInfo[PWIndex][submitIndex])
	
	self.port.emit("finishedAutofilling", "")
}

function findAllElements() {
	var elements = document.getElementsByTagName("*")
	return elements
}


/** find login form functions **/

function checkForLoginForm() {
	getPageInfo()
	console.log("checkForLoginForm()")
	var allForms = getAllForms()
	passwordForms = []
	if (allForms.length == 0) {
		console.log("There are no forms. Looking for individual elements")
		self.port.emit("requestingToFindIndividualElements", "")
	}
	else {
		console.log("Number of forms on this page: " + allForms.length)
		for (var i = 0; i < allForms.length; i++) {
			if (hasPasswordField(allForms[i]) == true) {
				//console.log("hasPWfield: " + allForms[i].elements[1].attributes[0].value)
				passwordForms.push(allForms[i])
			}
		}
		//check each possible form separately
		console.log("Checking form with password: " + passwordForms.length)
		translatedForms = translateForms(passwordForms)
		console.log(translatedForms)
		self.port.emit("hereArePageForms", translatedForms)
	}

}

function hasPasswordField(form) {
	var elements = form.elements
	if (elements.length == 0) {
		return false
	}
	for (var i = 0; i < elements.length; i++) {
		if (isPasswordField(elements[i]) == true)
			return true
	}
	return false
}

function isPasswordField(element) {
	return (element.type == "password")
}


/** functions that autofill forms **/
function autofillForm(details) {
	console.log("autofillForm()")
	var formIndex = details["formIndex"]
	var elementChoices = details["elementChoices"]
	console.log("formChoice: " + formIndex)
	console.log("usernameChoice: "+ elementChoices["username"].substring(7))
	console.log("passwordChoice: "+ elementChoices["password"].substring(7))
	console.log("submitChoice: "+ elementChoices["submit"].substring(7))
	
	//turn autocomplete on 
	turnOnAutocomplete(passwordForms[formIndex][elementChoices["username"].substring(7)])
	turnOnAutocomplete(passwordForms[formIndex][elementChoices["password"].substring(7)])

	passwordForms[formIndex][elementChoices["username"].substring(7)].value = dummyUsername
	
	passwordForms[formIndex][elementChoices["password"].substring(7)].value = dummyPassword
	
	/**Attempting to change the button appearance **/
	submitButton(passwordForms[formIndex][elementChoices["submit"].substring(7)])
	

	console.log("Done autofilling form")
	
	self.port.emit("finishedAutofilling", "")
								
}

function turnOnAutocomplete(element) {
	if (element != undefined & element != null) {
		if (element.autocomplete != null) {
			element.autocomplete = "on"
		}
	}
}

function submitButton(element) {
	element.style.color = "red"
	element.style.background = "green"
	element.innerHTML = "Found Submit Button"

	self.port.emit("submitClicked", "")
	setTimeout(function() {
		element.click()
	}, 2000)
	

}

/** ports listening for/sending instructions from/to main.js **/

//detect page click

self.port.on("findAllForms", function(message) {
	if (message == document.URL) {
		checkForLoginForm()
	}
}); 

self.port.on("findLoginElements", function(message){
	if (message == document.URL) {
		checkForLoginElements()
	}
}); 

self.port.on("autofillForm", function(message) {
	autofillForm(message)
}); 

self.port.on("autofillIndividualElements", function(message) {
	autofillIndividualElements(message)
});

/** Other helper methods **/
function translateElements(elements) {
	var translatedElements = {}
	if (elements.length == 0 ) {
		console.log("No elements to translate")
		return translatedElements
	}
	else {
		for (var i = 0; i < elements.length; i++) {
			translatedElements[i] = translateElement(elements[i])
		}
	}
	return translatedElements
}

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

function translateFormDetails(form){
	var result = {}
	if (form == null | form == undefined)
		return result
	var allAttributes = form.attributes 
	for (var i = 0; i < allAttributes.length; i++) {
		result[allAttributes[i].name] = allAttributes[i].value
	}
	return result	
}

function translateForm(form) {
	var result = {}
	if (form == null | form == undefined | form.elements.length == 0)
		return result
	var allElements = form.elements
	for (var i = 0; i < allElements.length; i++) {
		result["element" + i] = translateElement(allElements[i])
	}
	
	return result
}

function translateForms(forms) {
	var result = {}
	var formDetails = {}
	if (forms == null | forms == undefined | forms.length == 0)
		return result	
	for (var i = 0; i < forms.length; i++) {
		formDetails["elements"] = translateForm(forms[i])
		formDetails["form"] = translateFormDetails(forms[i])	
		result[i] = formDetails
		formDetails = {}
	}
	
	return result
}

function maximize() {
	window.moveTo(0,0)
	window.resizeTo(screen.width, screen.height)
}