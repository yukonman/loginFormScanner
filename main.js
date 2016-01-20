
const {Cc,Ci,Cr} = require("chrome");
const {components} = require("chrome"); 
var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
var cookieService2 = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2);
var file = require("sdk/io/file");
var tabs = require("sdk/tabs");
var pageMod = require("sdk/page-mod");
var pageWorker = require("sdk/page-worker");
var self = require("sdk/self");
var system = require("sdk/system");
var resultsPath = require("sdk/system").pathFor("Desk");
var fileComponent = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
var windows = require("sdk/windows").browserWindows;
var {setTimeout, clearTimeout, setInterval} = require("sdk/timers");
const { getTabContentWindow, getActiveTab } = require('sdk/tabs/utils');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');

var testFile = require("./ordered0-99");
//var testFile = require("./ordered100-999");
var testList = testFile.testList


var login_regexes = /(log[\s-_]?[io]n)|(sign[\s-_]?[io]n)/gi
var username_regexes = /(?:e[\s-_]?mail)|(user[\s-_]?name)|((log|sign)[\s-_]?in)|(log[\s-_]?[io]n[\s-_]?id)|(user[\s-_]?id)|(mobile[\s-_]?phone)|(phone[\s-_]?number)|(tele[\s-_]?phone)|(phone)|(id)|(account)|(acct)|(uname)|(mobile)/gi
var password_regexes = /(pass[\s-_]?word)|(pass[\s-_]code)|(secret[\s-_]?code)|(secret[\s-_]pass)|(secret)|(pass)|(code)|(passwd)|(pswd)/gi
var submit_regexes = /submit|enter|(log[\s-_]?[io]n)|(sign[\s-_]?[io]n)/gi //add more to this later!
var submit_only_regexes = /submit|enter/gi
var remember = /remember/gi

var singleSignOn_regexes = /auth|oauth|facebook|twitter|google|with/gi

var signup_regexes = /(sign[\s-_]?up)|(register)|(new)/gi
var name_regexes = /(?:name.*(first|middle|last))|(?:(first|middle|last).*name)|^(first|middle|last)|name$/gi
var birthday_regexes = /(birth[\s-_]?(day|date|dob|year))|(dob)|(b[\s-_]?day)|(birth)/gi
var gender_regexes = /gender|sex|(?:^(?:fe)?male)/gi
var telephone_regexes = /(tele[\s-_]phone)|(tel[\s-_]phone)|(phone[\s-_]number)|(phone)|(number)/gi
var address_regexes = /((street|house)[\s-_]?(name|number))|(address)|(addr)|(country)|(county)|(state)/gi
var forgot_regexes = /(forgot(ten)?)|(can(')?t)/gi
var shopping_regexes = /(shop(ping)?)|(cart)/gi

/*** Set site here for testing **/
var current = 24
var trafficIndex = 0
var autoProceed = 0
var deadpageTimeoutTime = 10000 //in ms
var pageIsAlive = 0

if (autoProceed == 0) {
	openNewSite(testList[current][0])
}

/** global variables for each website **/
var currentSiteName = ""
var currentURL = ""
var frontPageForms = []
var screenshotCount = 0

var clickReceived = 0


/**variables for subsite**/
var currentSiteNumbers = testList[current].length
var currentSiteCount = 1

if (currentSiteNumbers == 1) {
	currentSiteCount = 0
}
else {
	currentSiteCount = 1
}


/**Karen's variables**/

// top three elements
var topthree = [];
// elements already clicked on
var clicked = [];

var count = 0
var opened = false;
var identical = true;
var acceptingElements = true

//injects jQuery and buttonFinder.js everytime a new page loads
pageMod.PageMod({
	include: "*",
	contentScriptFile: [self.data.url("jquery-1.4.2.min.js"), self.data.url("findLoginForm.js"),  self.data.url("buttonFinder.js")],
	onAttach: function(worker) {
		findLogin(worker); 
	}, 
	attachTo: "top",
	contentScriptWhen: "end"
});

//Algorithm to see whether the page has changed
var beforeimg = captureTabToCompare()
var beforepix = beforeimg.data
var screenShotComparisonInterval = setInterval(function() {
	//take screenshot
	var afterimg = captureTabToCompare()
	var afterpix = afterimg.data
	var prop = compareImages(beforepix, afterpix)

	if (prop > 0.8) { //same, meaning the page is stalling, move onto the next website
		console.log("Page is stalling, moving on")
		writeResultsToFile("reason.txt", current+","+currentSiteCount+","+currentURL+","+"Page stalled")
		moveToNext()
	}
	else { //different
		console.log("Page is changing, do nothing")
	}
	beforeimg = afterimg;
	beforepix = afterpix;
},15000); 

function findLogin(worker)  {
	
	//Finds the index of a website by first opening google and passing it in as a URL parameter
	if (clickReceived == 0) {

		if (opened == false) {
			worker.port.on("siteURL", function(message) {
				var site = stripSiteName(message.substr(0, message.lastIndexOf("/")))
				message = stripSiteName(message.substr(message.lastIndexOf("/")), message.length);
				console.log(site)
				console.log(message)
				console.log(isNumber(message))
				if (site == "google.com" & isNumber(message) == true) {
					current = message
				}
				opened = true
				setTimeout(function() {
					resetScanner()
						
				},2000);
					
			});
		}

		
		worker.port.on("IHaveLoaded", function(message){
			pageIsAlive = 1
			captureScreen("frontpage")
			currentURL = message
			console.log("Script loaded on " + message)
			worker.port.emit("findAllForms", message)
			count++
		}); 
		
		worker.port.on("pageClicked", function() {
			//wait 5 seconds for the page to finish changing!
			setTimeout(function() {
				//if (state == asdf) //checkstate!
				console.log("PHASE A: FIND LOGIN FORM")
				worker.port.emit("findAllForms", currentURL)
			}, 10000)

		}); 
		
		worker.port.on("hereArePageForms", function(possibleForms) {
			
			var result = processForms(possibleForms)
			if (result == false) { //no forms were given, find form on another page
				console.log("No possible forms found.")
				writeResultsToFile("reason.txt", current+","+currentSiteCount+","+currentURL+","+"No possible forms found")
				captureScreen("failed")
				console.log("Looking for login items")
				worker.port.emit("findLoginElements", currentURL)

			}
			else {
				//check front page first form
				var sendOver; 
				for (res in result){
					sendOver = result[res]
					break
				}
				var firstFormIndex = frontPageForms[0][0]
				worker.port.emit("autofillForm", {"formIndex":firstFormIndex, "elementChoices":sendOver})
				worker.port.emit("clickSubmit", "")
			}
		}); 
		
		worker.port.on("requestingToFindIndividualElements", function() {
			worker.port.emit("findLoginElements", currentURL)
		}); 
		
		worker.port.on("noPossibleElementsOnPage", function() {
			console.log("No possible forms nor elements found")
			writeResultsToFile("reason.txt", current+","+currentSiteCount+","+currentURL+","+"No possible forms nor elements found")
			console.log("PHASE B: FIND FORM-REVEALING BUTTON")
			console.log("MOVE TO NEXT PAGE")
			worker.port.emit("findRelevantElements", ""); 
		});
		
		worker.port.on("foundPasswordandSurroundingElements", function(passwordElements) {
			var result = processPasswordElements(passwordElements)
			
			if (result == false){
				console.log("No possible password element sets")
				writeResultsToFile("reason.txt", current+","+currentSiteCount+","+currentURL+","+"No possible password element sets")
				console.log("PHASE B: FIND FORM-REVEALING BUTTON")
				console.log("MOVE TO NEXT PAGE")
				worker.port.emit("findRelevantElements", ""); 
			}
			else {
				//check most likely PW field set
				worker.port.emit("autofillIndividualElements", result[0])
				worker.port.emit("clickSubmit", "")
			}
		});
		
		worker.port.on("finishedAutofilling", function() {
				captureScreen("autofill")
		}); 
		
		worker.port.on("submitClicked", function() {
			clickReceived = 1
			setTimeout(function() {
				current++
				resetScanner()
				
			}, 5000); 

		}); 
		
		//relevant elements for the form-revealing button
		worker.port.on("hereAreRelevantElements", function(relevantElements) {
			// result has indices of top 3 relevant things
			var result = analyzeRevealingElements(relevantElements)
			console.log(relevantElements[result[0]])
			if (result == null | result == undefined | result.length == 0) {
				console.log("There are no relevant elements!")
				writeResultsToFile("reason.txt", current+","+currentSiteCount+","+currentURL+","+"There are no relevant form-revealing elements!")
			}
			else if (identical == true & acceptingElements == true) {//} & count == 1) {
				var beforeimg = captureTabToCompare()
				var beforepix = beforeimg.data
				worker.port.emit("clickElement", result[0])
				clicked.push(relevantElements[result[0]])
				acceptingElements = false;
				setTimeout(function() {
					var afterimg = captureTabToCompare()
					var afterpix = afterimg.data
					var prop = compareImages(beforepix, afterpix)
					console.log(prop)
					// if page is same click next thing
					if (prop > 0.88) {
						writeResultsToFile("reason.txt", current+","+currentSiteCount+","+currentURL+","+"Page didn't change after first click")
						worker.port.emit("clickElement", result[1])
						clicked.push(relevantElements[result[1]])
						setTimeout(function() {
							var afterimg2 = captureTabToCompare()
							var afterpix2 = afterimg2.data
							var prop2 = compareImages(afterpix, afterpix2)
							console.log(prop2)
							// third try...
							if (prop2 < 0.88) {
								writeResultsToFile("reason.txt", current+","+currentSiteCount+","+currentURL+","+"Page didn't change after second click")
								worker.port.emit("clickElement", result[2])
								clicked.push(relevantElements[result[2]])
								setTimeout(function() {
									var afterimg3 = captureTabToCompare()
									var afterpix3 = afterimg3.data
									var prop3 = compareImages(afterpix2, afterpix3)
									console.log(prop3)
									if (prop3 < 0.88) {
										identical = false;
										console.log("Page remains unchanged after 3 clicks")
										writeResultsToFile("reason.txt", current+","+currentSiteCount+","+currentURL+","+"Page didn't change after third click")
										
									}
									else
										acceptingElements = true;
								}, 10000);
							}
							else
								acceptingElements = true;
						}, 10000);
					}
					else
						acceptingElements = true;
				}, 10000);
			}
		});
	}
}

//functions that help the scanner cycle through cites
function closeAllOtherTabs() {
	for (let tab of tabs) {
		if (tab != tabs.activeTab) {
			tab.close()
		}
	}
	for (win of windows) {
		if (win != windows.activeWindow) {
			win.close()
		}
	}
}

function openNewSite(site) {
	
	setTimeout(function() {
		tabs.activeTab.url = "about:blank"
		setTimeout(function() {
			currentSiteName = testList[current][0]
			currentSiteNumbers = testList[current].length
			tabs.open(site);			
		}, 1000); 

	}, 2000); 
}

function moveToNext() {
	if (autoProceed == 1) {
		if (currentSiteCount == currentSiteNumbers-1) {
			currentSiteCount = 0
			resetSubScanner()
		}
		else if (currentSiteCount == 0) { //
			current++
			resetScanner()
		}
		else {
			currentSiteCount++
			resetSubScanner()
		}	
	}	

}

function resetSubScanner() {
	
	trafficIndex = 0
	currentURL = ""
	frontPageForms = []
	topthree = [];
	clicked = [];

	count = 0
	identical = true;
	acceptingElements = true
	
	pageIsAlive = 0
	screenshotCount = 0
	clickReceived = 0
	openNewSite(testList[current][currentSiteCount])
}

function resetScanner() {
	if (autoProceed == 1) {
		writeResultsToFile(current + "_" + stripSiteName(testList[current][0]), current + "_" + stripSiteName(testList[current][0]))
		trafficIndex = 0
		currentSiteName = ""
		currentURL = ""
		frontPageForms = []
		topthree = [];
		clicked = [];

		count = 0
		identical = true;
		acceptingElements = true
		
		pageIsAlive = 0
		screenshotCount = 0
		clickReceived = 0
		currentSiteNumbers = testList[current].length
		if (currentSiteNumbers == 1) {
			currentSiteCount = 0
		}
		else {
			currentSiteCount = 1
		}
		
		
		openNewSite(testList[current][currentSiteCount])
	}
}

tabs.on('ready', function() {
	closeAllOtherTabs()

	getMostRecentBrowserWindow().BrowserFullScreen(); 
});
 
//functions that find the revealing button
function analyzeRevealingElements(relevantElements) {
	// scores for each element returned
	var scores = []
	for (var i = 0; i < relevantElements.length; i++) {
		scores.push(scoreLoginButtonElement(relevantElements[i]))
	}
	
	var indices = []
	for (var i = 0; i < relevantElements.length; i++) {
		indices.push(i)
	}
	indices.sort(function (a,b) { return scores[a] < scores[b] ? -1 : scores[a] > scores[b] ? 1 : 0; }).reverse()

	// top three relevant things
	for (var i = 0; i < Math.min(relevantElements.length, 3); i++) {
		topthree.push(relevantElements[indices[i]])
	}
	//console.log(topthree)
	//console.log(relevantElements.length)
	console.log(scores)
	//console.log(indices)
	//console.log(relevantElements[1])
	
	// return top 3 likely indices of elements
	if (relevantElements.length < 3) {
		var temp = []
		for (var i = 0; i < relevantElements.length; i++) {
			temp.push(i)
		}
		return temp
	}
	return indices.slice(0,3)
}

function scoreLoginButtonElement(element) {
	if (element == null | element == undefined)
		return 0 
	
	//scoring
	var score = 0
	for (attribute in element) {
		if (attribute == "innerHTML" & element[attribute].match(login_regexes) != null)
			score += 2*element[attribute].match(login_regexes).length
		else if (element[attribute].match(login_regexes) != null)
			score += element[attribute].match(login_regexes).length
		else if (element[attribute].match(singleSignOn_regexes))
			score -= 3*element[attribute].match(singleSignOn_regexes).length
		else if (element[attribute].match(signup_regexes))
			score -= 2*element[attribute].match(signup_regexes).length
		else if (element[attribute].match(forgot_regexes))
			score -= 4*element[attribute].match(forgot_regexes).length
	}

	return score
}


//functions that find individual username/pw/submit
function processPasswordElements(passwordElements) {
	if (passwordElements == null | passwordElements == undefined) {
		return false
	}
	var scores = {} //{pwEle: {totalPWScore: xxx, usernameIndex: x, submitIndex: x}}
	var usernameScores = {}
	var submitScores = {}
	for (pwEle in passwordElements) {
		var totalPWScore = 0
		var usernameChoices = []
		var submitChoices = []
		for (eachEle in passwordElements[pwEle]) {
			usernameChoices.push(scoreUsernameField(passwordElements[pwEle][eachEle]))
			submitChoices.push(scoreSubmitButton(passwordElements[pwEle][eachEle]))
			totalPWScore -= getSignUpFieldScore(passwordElements[pwEle][eachEle])
		}

		if (usernameChoices.every(allZeros) | submitChoices.every(allZeros)) {
			scores[pwEle] = 0
			continue
		}
		
		var submitArg = getArgMax(submitChoices)
		var usernameArg = getArgMax(usernameChoices)
		if (submitArg == usernameArg) { //if they're the same, choose the next likely username
			usernameChoices[usernameArg] = 0
			if (usernameChoices.every(allZeros)) {
				scores[pwEle] = 0
				continue
			}
			usernameArg = getArgMax(usernameChoices)
		}
		
		totalPWScore += submitChoices[submitArg] + usernameChoices[usernameArg]
		if (totalPWScore < 0) {
			scores[pwEle] = 0
			continue
		}
		
		var subFinal = {}
		subFinal["PWIndex"] = pwEle
		subFinal["totalPWScore"] = totalPWScore
		subFinal["usernameIndex"] = usernameArg
		subFinal["submitIndex"] = submitArg
		scores[pwEle] = subFinal

	}
	
	return scores

}

//functions that find login forms
function processForms(forms) {
	//rule our undefined forms
	if (forms == null | forms == undefined) {
		return false
	}
	
	//count the number of forms
	var countForms = 0 
	for (choice in forms) {
		countForms ++
	}
	if (countForms == 0) {
		return false
	}
	
	var resultingForms = {}
	var elementAnalysis = {}
	var resultingCount = 0
	
	//choose those forms that look like login forms
	for (form in forms) {
		
		if (forms[form]["form"]["type"] != "hidden" & forms[form]["form"]["aria-hidden"] != true ) { //ignore if the form is hidden
			console.log("Analyzing form: " + form)
			var formScore = getTotalAttributeScores(forms[form])

			var elementResults = scoreLoginFormElements(forms[form])
			
			if (elementResults == 0) {
				formScore = 0
			}
			else {
				formScore += elementResults["totalScore"]

				//console.log("result for form: " + form + ", " + formScore + ", " + elementResults["username"])
				elementAnalysis[form] = elementResults

				resultingForms[form] = formScore
					
			}
			

			resultingCount += 1
		}
		else {
			console.log(forms[form] + "hidden")
		}
	}
	
	for (ele in elementAnalysis) {
		if (elementAnalysis[ele] != 0) {
			break
		}
		return false
	}
	
	if (resultingCount == 0 | Object.keys(resultingForms).length  == 0) {
		return false
	}
	else {
		frontPageForms = rankByValue(resultingForms)
		console.log(frontPageForms)
		return elementAnalysis
	}
}

function getTotalAttributeScores(form) {
	/** fix here for heuristic tweeks**/
	return scoreLoginFormAttributes(form) - scoreSignUpFormAttributes(form)
}

function scoreLoginFormAttributes(form) {
	//want to see things like login, method: post, action, etc. but their absence doesn't mean this isn't a login form
	//work on this if current scoring system is not enough
	var totalScore = 0
	for (attribute in form["form"]) {
		var currentString = form["form"][attribute]
		totalScore += matchRegex(currentString, login_regexes)
		totalScore -= matchRegex(currentString, singleSignOn_regexes)
	}
	
	return totalScore 
}

function scoreLoginFormElements(form) {
	//username, password, submit, remember me 
	var visibleElements = getVisibleElements(form)
	
	if (visibleElements.length == 0) { //no visible elements in this form
		return 0 //this form gets a score of 0 if there are no visible elements
	}
	
	var allScores = getElementScores(form, visibleElements)
	
	if (allScores == []) {
		console.log("no scores")
		return 0
	}
	
	//console.log(allScores)
	
	var scoreAnalysis = analyzeScores(allScores)
	console.log(scoreAnalysis)
	
	if (scoreAnalysis == 0) {
		console.log("this form is not possible")
		return 0
	}
	else {
		console.log("scoreAnalysis")
		return scoreAnalysis
	}
	
	return 0
}

function scoreSignUpFormAttributes(form) {
	//need to heavily penalize forms that look like sign up
	//cannot rule them out completely because developers might make careless typos
	
	var totalScore = 0
	for (attribute in form["form"]) {
		var currentString = form["form"][attribute]
		totalScore += matchRegex(currentString, signup_regexes)
	}
	return totalScore 
}

function getElementScores(elements, visibleElements) {
	var allScores = {}
	//order of username, password, submit. [[element0username, element0pas, element0submit], [element1 etc]]
	
	if (elements["elements"] != null | elements["elements"] != undefined) { //this is a form
		for (var i = 0; i < visibleElements.length; i++) {

			var currentElement = elements["elements"][visibleElements[i]]
			var scoreForElement = []
			//username
			scoreForElement.push(scoreUsernameField(currentElement))
			
			//password
			scoreForElement.push(scorePasswordField(currentElement))
			
			//submit
			scoreForElement.push(scoreSubmitButton(currentElement))
			
			allScores[visibleElements[i]] = scoreForElement
		}
	}
	else {//these are separate elements
		console.log("Separate elements; work on this!")
	}
	
	console.log(allScores)
	return allScores
}

function analyzeScores(scores) {
	//probably will need to make this more sophisticated
	//currently, the elements in front have priority of (in order) username, password, submit
	var answer = {}
	var foundUsername = 0
	var foundPassword = 0
	var foundSubmit = 0
		
	var lookupTable = []
	var wholeArray = []
	
	var rowResults = {}
	var rowGlobalMax = 0
	
	var columnGlobalMax = 0
	
	var column = 0
	
	for (ele in scores) {
		if (!scores[ele].every(allZeros)) { //skip irrelevant elements
			lookupTable.push(ele)
			wholeArray.push(scores[ele])
			
			var argMax = getArgMax(scores[ele])
			var max = Math.max(...scores[ele])
			
			//search row-wise
			if (foundUsername == 0 & argMax == 0) {
				rowResults["username"] = ele
				foundUsername = 1
				rowGlobalMax += max
			}
			
			if (foundPassword == 0 & argMax == 1) {
				rowResults["password"] = ele
				foundPassword = 1
				rowGlobalMax += max
			}
			
			if (foundSubmit == 0 & argMax == 2) {
				rowResults["submit"] = ele
				foundSubmit = 1
				rowGlobalMax += max
			}
		}

	}
	
	
	//search column wise
	//best username, password, submit candidates
	var usernameColumn = wholeArray.map(function(value,index) { return value[0]; });
	var passwordColumn = wholeArray.map(function(value,index) { return value[1]; });
	var submitColumn = wholeArray.map(function(value,index) { return value[2]; });
	
	if (usernameColumn.every(allZeros) | passwordColumn.every(allZeros) | submitColumn.every(allZeros)) {
		return 0 
	}
	
	var argUserCol = lookupTable[getArgMax(usernameColumn)]
	var argPassCol = lookupTable[getArgMax(passwordColumn)]
	var argSubCol = lookupTable[getArgMax(submitColumn)]
	
	columnGlobalMax += Math.max(...passwordColumn)
	
	//if there's an overlap
	if (argUserCol == argSubCol) {
		//priority goes to the "max" with the higher score
		var maxUser = Math.max(...usernameColumn)
		var maxSub = Math.max(...submitColumn)
		
		var indices = []
		indices.push(argUserCol)
		if (maxUser > maxSub) { //submit needs to change
			argSubCol = lookupTable[getArgMaxExcept(submitColumn, indices)]
			columnGlobalMax += maxUser
			columnGlobalMax += submitColumn[argSubCol]
		}
		else {
			argUserCol = lookupTable[getArgMaxExcept(usernameColumn, indices)]
			columnGlobalMax += maxSub
			columnGlobalMax += usernameColumn[argUserCol]
			
		}
	}
	
	if (columnGlobalMax > rowGlobalMax) { //if they're the same, priority goes to columnGlobalMax
		column = 1
	}

	if (column == 1) {
		console.log("Chose column analysis")
		answer["username"] = argUserCol
		answer["password"] = argPassCol
		console.log(argSubCol)
		answer["submit"] = argSubCol
		answer["totalScore"] = columnGlobalMax
		return answer
	}
	else {
		if (foundUsername == 1 & foundPassword == 1 & foundSubmit == 1) {
			console.log("Chose row analysis")
			rowResults["totalScore"] = rowGlobalMax
			return rowResults
		}
		else {
			return 0
		}
	}
	return 0

}



function scoreUsernameField(element) {
	//future tweeks: penalize for having keywords such as "password"
	var totalScore = 0
	var textoremail = 0
	for (attribute in element) {
		
		var currentString = element[attribute]
		
		if ((attribute == "type" & currentString == "email") | (attribute == "type" & currentString == "text")) {
			textoremail ++ 
		}
		
		totalScore += matchRegex(currentString, username_regexes)
		totalScore -= matchRegex(currentString, password_regexes)
		totalScore -= matchRegex(currentString, submit_only_regexes)
		totalScore -= matchRegex(currentString, singleSignOn_regexes)

		//console.log("currentString: " + currentString + ", "+ matchRegex(currentString, username_regexes))
	}
	
	if (textoremail == 0) { //username field has to have type = text or type = email
		return 0 
	}
	return totalScore 
}

function scorePasswordField(element) {

	var totalScore = 0
	for (attribute in element) {
		var currentString = element[attribute]
		if (element[attribute] == "password" & attribute == "type") {
			totalScore += 10
		}
		totalScore += matchRegex(currentString, password_regexes)
		totalScore -= matchRegex(currentString, username_regexes)
		totalScore -= matchRegex(currentString, submit_only_regexes)
		totalScore -= matchRegex(currentString, singleSignOn_regexes)
		//console.log("currentString: " + currentString + ", "+ matchRegex(currentString, password_regexes))
	}
	return totalScore 
}

function scoreSubmitButton(element) {
	//improve this by adding more keywords!
	var labelWeight = 5
	
	var totalScore = 0 
	for (attribute in element) {
		var currentString = element[attribute]
		totalScore += 2*matchRegex(currentString, submit_regexes)
		totalScore -= matchRegex(currentString, username_regexes)
		totalScore -= matchRegex(currentString, password_regexes)
		totalScore -= 2*matchRegex(currentString, signup_regexes)
		//totalScore -= matchRegex(currentString, singleSignOn_regexes)
		//console.log("currentString: " + currentString + ", "+ matchRegex(currentString, submit_regexes))
	}
	
	if (element["innerHTML"].match(login_regexes) != null) { //heavily reward buttons that have innerHTML of "login" etc
		totalScore += element["innerHTML"].match(login_regexes).length * labelWeight
		//console.log("innerHTML " + element["innerHTML"])
	}
		
	if (element["value"] != null & element["value"] != undefined) {
		if (element["value"].match(login_regexes) != null) { //heavily reward buttons that have value of "login" etc
			totalScore += element["value"].match(login_regexes).length * labelWeight
			//console.log("value " + element["value"])
		}
	}
	return totalScore
}

function getSignUpFieldScore(element) {
	var totalScore = 0 
	for (attribute in element) {
		var currentString = element[attribute]
		totalScore += matchRegex(currentString, name_regexes) + matchRegex(currentString, birthday_regexes)+ matchRegex(currentString, gender_regexes) + matchRegex(currentString, telephone_regexes) + matchRegex(currentString, address_regexes)
	}
	return totalScore
}

/**General helper functions**/

function getVisibleElements(form) {
	var visibleElements = []
	for (element in form["elements"]) {
		var shouldSkip = 0
		for (attribute in form["elements"][element]) {
			console.log(attribute + ", " + form["elements"][element][attribute])
			if ((attribute == "type" & form["elements"][element][attribute] == "hidden") ) { //don't consider hidden elements
				shouldSkip = 1
			}
			if (attribute.indexOf("hidden") != -1 & form["elements"][element][attribute] == "true") {
				shouldSkip = 1
			}
				
		}
		if (shouldSkip == 0) {
			visibleElements.push(element)
		}
		
	}
	return visibleElements	
}

function isElementVisible(element) {
	for (attribute in form["elements"][element]) {
		if ((attribute == "type" & form["elements"][element][attribute] == "hidden") ) { //don't consider hidden elements
			return false
		}	
	}
	return true
}

function matchRegex(string, regex) {
	if (string == undefined | string == null) {
		console.log("string in matchRegex() is undefined or null")
		return 0
	}
	else if (string.match(regex) == null) {
		return 0
	}
	else if (string.match(regex) != null) {
		return string.match(regex).length
	}
	else {
		return 0
	}
}

function allZeros(element, index, array) {
	return element <= 0
}

//helpers to get max scores
function getArgMax(array) {
	if (array.length == 0) {
		console.log("getArgMax needs an array larger than 0 elements")
	}
	var max = Math.max(...array)
	var argmax = array.indexOf(max)
	return argmax
}

function getArgMaxExcept(array, indices) {
	for (var i = 0; i < indices.length; i++) {
		array.splice(indices[i], 1)
	}
	return getArgMax(array)
}

function rankByValue(toSort) {
	var sortable = [];
	for (var element in toSort)
		sortable.push([element, toSort[element]])
	sortable.sort(function(a, b) {return a[1] - b[1]})
	return sortable.reverse()
}

function isNumber (o) {
  return ! isNaN (o-0) && o !== null && o !== "" && o !== false;
}

//Helper functions for image comparison
function compareImages(beforepix, afterpix) {
	// beforeimg, afterimg are pixel data from ImageData objects returned from captureTab()
	// returns the proportion of pixels that are the same
	var pixelcount = 0
	for (var i = 0; i < beforepix.length; i++) {
		if (beforepix[i] === afterpix[i])
			pixelcount++;
	}
	var prop = pixelcount / beforepix.length
	return prop
}

function captureTabToCompare(tab=getActiveTab(getMostRecentBrowserWindow())) {
  let contentWindow = getTabContentWindow(tab);
  let { document } = contentWindow;

  let w = contentWindow.innerWidth;
  let h = contentWindow.innerHeight;
  let x = contentWindow.scrollX;
  let y = contentWindow.scrollY;

  let canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');

  canvas.width = w;
  canvas.height = h;

  let ctx = canvas.getContext('2d');
  ctx.drawWindow(contentWindow, x, y, w, h, '#000');

  //let dataURL = canvas.toDataURL();
  //canvas = null;
  //return dataURL;

  return ctx.getImageData(x, y, w, h);
}

/** Helper functions for screen shots **/
function captureScreen(notes) {
	screenshotCount++
	var filename = extractCurrentSiteName() + "_" +  screenshotCount
	writeToFile(filename, "\<html\>\<img src=\"" + captureTab() + "\"\>\<\/html\>", notes)
}

function stripSiteName(site) {
	var siteName = site
	siteName = siteName.replace("http://", "")
	siteName = siteName.replace("https://", "")
	siteName = siteName.replace("www.", "")
	siteName = siteName.replace("/", "")
	return siteName
}

function writeResultsToFile(filename, content) {
	//console.log("writeResultsToFile()")
	var fullPath = resultsPath + "\\screenShots\\results\\" + filename + ".txt"
	//console.log(fullPath)
	fileComponent.initWithPath(fullPath);
	
	var foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);

	foStream.init(fileComponent, 0x02 | 0x08 | 0x10, 0666, 0); 

	var converter = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
	converter.init(foStream, "UTF-8", 0, 0);
	converter.writeString(content +"\n");
	converter.close(); // this closes foStream
}

function writeToFile(fileName, content, notes){
	
	var fullPath = resultsPath + "\\screenShots\\"+ notes + "\\" + current+"_"+fileName + ".html"
	console.log(fullPath)

	fileComponent.initWithPath(fullPath);
	
	var foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);

	foStream.init(fileComponent, 0x02 | 0x08 | 0x20, 0666, 0); 

	var converter = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
	converter.init(foStream, "UTF-8", 0, 0);
	converter.writeString(content);
	converter.close(); // this closes foStream

}

function captureTab(tab=getActiveTab(getMostRecentBrowserWindow())) {
  let contentWindow = getTabContentWindow(tab);
  let { document } = contentWindow;

  let w = contentWindow.innerWidth;
  let h = contentWindow.innerHeight;
  let x = contentWindow.scrollX;
  let y = contentWindow.scrollY;

  let canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');

  canvas.width = w;
  canvas.height = h;

  let ctx = canvas.getContext('2d');

  ctx.drawWindow(contentWindow, x, y, w, h, '#000');

  let dataURL = canvas.toDataURL();

  canvas = null;

  return dataURL;

}

function extractCurrentSiteName() {
	var siteurl = testList[current][0]; 
	var sitename = siteurl.substring(7, siteurl.length-4); 
	return sitename; 
}

/**Traffic Listeners **/

function TracingListener() {
    this.originalListener = null;
	this.receivedData = [];
}

TracingListener.prototype =
{
    onDataAvailable: function(request, context, inputStream, offset, count)
    {
        var binaryInputStream = CCIN("@mozilla.org/binaryinputstream;1", "nsIBinaryInputStream");
        var storageStream = CCIN("@mozilla.org/storagestream;1", "nsIStorageStream");
        var binaryOutputStream = CCIN("@mozilla.org/binaryoutputstream;1","nsIBinaryOutputStream");

        binaryInputStream.setInputStream(inputStream);
        storageStream.init(8192, count, null);
        binaryOutputStream.setOutputStream(storageStream.getOutputStream(0));

        // Copy received data as they come.
        var data = binaryInputStream.readBytes(count);
        this.receivedData.push(data);	
		//console.log(data); 
				
		//to modify response, modify the variable 'data' above. The next statement is going to write data into outputStream and then pass it to the next listener (and eventually the renderer).
        binaryOutputStream.writeBytes(data, count);

        this.originalListener.onDataAvailable(request, context, storageStream.newInputStream(0), offset, count);
		//console.log(request); 
    },

    onStartRequest: function(request, context) {
		//console.log("request:" + context); 
        this.originalListener.onStartRequest(request, context);
    },

    onStopRequest: function(request, context, statusCode)
    {
 
		this.originalListener.onStopRequest(request, context, statusCode);

    },

    QueryInterface: function (aIID) {
        if (aIID.equals(Ci.nsIStreamListener) ||
            aIID.equals(Ci.nsISupports)) {
            return this;
        }
        throw Cr.NS_NOINTERFACE;
    }
}


observerService.addObserver({
    observe: function(aSubject, aTopic, aData) {
		if ("http-on-modify-request" == aTopic) {
			var gchannel = aSubject.QueryInterface(Ci.nsIHttpChannel)
			var url = gchannel.URI.spec;			 

			var postDATA = "";
			var cookies = "";

			try {cookies = gchannel.getRequestHeader("cookie");} catch(e){}						//this creates lots of errors if not caught 
			
			var facebook = false; 
			var google = false;
			var	twitter = false; 
			var currentSiteName = extractCurrentSiteName(); 
			if (currentSiteName == "facebook")
				facebook = true; 
			if (currentSiteName == "google")
				google = true; 
			if (currentSiteName == "twitter")
				twitter = true; 
			
			var poststr = ""; 
			
			if ( ((gchannel.requestMethod == "GET") || (gchannel.requestMethod == "POST"))
				/**&& beginTest == 1**/
				&& !(url.endsWith(".css") || url.endsWith(".js") || url.endsWith(".png") || url.endsWith(".gif") || url.endsWith(".jpg")) 
				&& (url.indexOf("ocsp") == -1 && url.indexOf("facebook.com/ajax/bz") == -1 && url.indexOf("safebrowsing") == -1 && url.indexOf("symcb") == -1 && url.indexOf("symcd") == -1 && url.indexOf("syndication.twitter.com") == -1)
				&& (facebook == (url.indexOf("facebook") != -1))
				&& (google == (url.indexOf("google") != -1))
				&& (twitter == (url.indexOf("twitter") != -1)) 
				) {
				//console.log("At GET/POST")
				var ajax = ""; 
				

				if ((gchannel.requestMethod) == "POST") {
					//console.log("Post received" );
					var channel; 
					try {
						channel = gchannel.QueryInterface(Ci.nsIUploadChannel).uploadStream; 
						var prevOffset = channel.QueryInterface(Ci.nsISeekableStream).tell();
						channel.QueryInterface(Ci.nsISeekableStream).seek(Ci.nsISeekableStream.NS_SEEK_SET, 0);  
						var stream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);  
						stream.setInputStream(channel); 		
								
						var postBytes = stream.readByteArray(stream.available());  			
						poststr = postBytes.toString();
						postrequeststring = poststr; 
						//console.log(url + ": " + gchannel.requestMethod +  ": " + poststr);				
						channel.QueryInterface(Ci.nsISeekableStream).seek(Ci.nsISeekableStream.NS_SEEK_SET, prevOffset);
					}
					catch(e){
						errormessage = "exception occurred with channel while listening for requests."
					}				
				}
				else { //GET request
					//console.log("GET received")
					poststr = url; 
				}
				//console.log("poststr: " + poststr)
				try {
					ajax = gchannel.getRequestHeader("x-requested-with"); // == "XMLHttpRequest"
				}
				catch (e) {}	
				writeResultsToFile(current + "_" + stripSiteName(testList[current][0]), trafficIndex + "," + url + "," + gchannel.requestMethod +  "," + poststr + ","+ ajax +"\n")
				trafficIndex ++


				
			}
			
		}
	}	
}, "http-on-modify-request", false);