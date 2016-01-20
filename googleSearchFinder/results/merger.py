#!/usr/bin/env python
import simplejson
import re
from operator import itemgetter

def importList(list):
	file = __import__(list)
	return file.testList
	
def printListtoFile(filename, list):
	f = open(filename, 'w')
	
	simplejson.dump(list, f)
	f.close()

def mergeLists():
	
	baselist = importList("merged1")
	add = importList("100-999signin")
	
	for i in range(len(baselist)):
		for j in range(len(add)):
			currentKey = baselist[i][0]
			if (currentKey == add[j][0]):
				baselist[i].append(add[j][1])
				baselist[i].append(add[j][2])
				continue
			print "Error: did not find match"
			
	printListtoFile("merged2.txt", baselist)

def removeDuplicates(list):
	returnList = []
	for i in range(len(list)):
		newlist = [ii for n,ii in enumerate(list[i]) if ii not in list[i][:n]]
		returnList.append(newlist)
	return returnList

def stripHttp(string):
	siteName = string
	siteName = siteName.replace("http://", "")
	siteName = siteName.replace("https://", "")
	siteName = siteName.replace("www.", "")
	siteName = siteName.rstrip("/")
	return siteName

def removeIrrelevant(list):
	newList = list
	for i in range(len(list)):
		#sitename is the domain; delete the http://www or http://
		siteName = stripHttp(list[i][0])

		todelete = []
		for j in range(1, len(list[i])):
			if (siteName not in list[i][j]):
				#print list[i][j]
				todelete.append(j)
			if (siteName == stripHttp(list[i][j])):
				#print list[i][j]
				todelete.append(j)
			if ((siteName != "alexa.com") and ("alexa.com" in list[i][j])):
				todelete.append(j)
		for z in reversed(range(len(todelete))):
			newList[i].remove(list[i][todelete[z]])
	return newList

def getRegexPoints(string):
	totalPoints = 0
	#assign points and regexes
	loginsignin_P = 5
	loginsignin_Regex = re.compile("(log[-\s_]?[io]n)|(sign[-\s_]?[io]n)|(authorize)", re.IGNORECASE)

	account_P = 3
	account_Regex = re.compile("(account)|(accnt)|(acct)|(session)", re.IGNORECASE)

	sso_P = 1
	sso_Regex = re.compile("(auth)|(oauth)", re.IGNORECASE)

	signup_P = 2
	signup_Regex = re.compile("(sign[-\s_]?up)|(register)|(new)", re.IGNORECASE)

	others_P = 1
	others_Regex = re.compile("(shop)|(cart)|(users)", re.IGNORECASE)

	if (loginsignin_Regex.search(string) != None):
		totalPoints += loginsignin_P
	if (account_Regex.search(string) != None):
		totalPoints += account_P
	if (sso_Regex.search(string) != None):
		totalPoints += sso_P
	if (signup_Regex.search(string) != None):
		totalPoints += signup_P
	if (others_Regex.search(string) != None):
		totalPoints += others_P

	return totalPoints

def orderImportance(list):
	newList = []

	for i in range(len(list)):
		keyvalue = {}
		newsitelist = []
		newsitelist.append(list[i][0])
		for j in range(1, len(list[i])):
			keyvalue[list[i][j]] = getRegexPoints(list[i][j])
		sortedkeyvalue = sorted(keyvalue.items(), key=itemgetter(1), reverse=True)
		for z in range(len(sortedkeyvalue)):
			newsitelist.append(sortedkeyvalue[z][0])
		newList.append(newsitelist)
	
	return newList
			


if __name__ == '__main__':
	#mergeLists()
	list = importList("merged2")
	duplicatesRemoved = removeDuplicates(list)
	relevantList = removeIrrelevant(duplicatesRemoved)
	orderedList = orderImportance(relevantList)
	printListtoFile("ordered100-999", orderedList)

	#print relevantList



			
	
