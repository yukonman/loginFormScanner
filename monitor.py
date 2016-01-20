import subprocess, threading, time, os, psutil, sys, glob
resultsdir = r"C:\Users\hannah.li\Desktop\screenShots\results" #CHANGE THIS
s =  17#START INDEX CHANGE THIS

def kill_proc_tree(pid, including_parent=True):    
	parent = psutil.Process(pid)
	for child in parent.children(recursive=True):
		try:
			child.kill()
		except:
			print "Exception occurred when killing parent"
	if including_parent:
		try:
			parent.kill()
		except:
			print "Exception occurred when killing parent"
		
class Command(object):	

	def __init__(self, cmd):
		self.cmd = cmd
		self.process = None

	def run(self, numsites, filename):
		def target():
			print 'Thread started'
			self.process = subprocess.Popen(self.cmd, shell=True)
			self.process.communicate()
			print 'Thread finished'

		thread = threading.Thread(target=target)
		thread.start()

		while (1):
			numresults1 = len([name for name in os.listdir(resultsdir) if os.path.isfile(os.path.join(resultsdir, name))])
			time.sleep(40)
			numresults2 = len([name for name in os.listdir(resultsdir) if os.path.isfile(os.path.join(resultsdir, name))])
			print "num1: " + str(numresults1) + ", num2: " + str(numresults2)
			newstart = max(s, numresults2) + 1
			if (numresults1 == numresults2):
				print 'Terminating test because website timed out'   
				me = self.process.pid
				kill_proc_tree(me)
				thread.join()

				failedat = max(glob.iglob(os.path.join(resultsdir, '*.txt')), key = os.path.getctime)
				printTimedOut(failedat, numresults2, newstart);
				startTest(newstart, numsites, filename); 
			if (newstart > numsites):
				#print "Finished Testing All Sites. Times restarted ="
				break

def startTest(start, numsites, filename):
	start = str(start)
	commandline = 'jpm run -p user0/ --binary-args google.com/' + start
	print commandline
	command = Command(commandline)
	print 'Starting to test', start
	result = command.run(numsites, filename)

def printTimedOut(file, index, newindex):
	file = open(file, 'a')
	file.write('\nTest failed at index ' + str(index) + '.......... Restarting test at index ' + str(newindex))
	file.close()

if __name__ == "__main__": 
	numsites = 900
	filename = "results.txt"
	startTest(s, numsites, filename)