
setwd("C:/Users/Karen/Dropbox/loginHannah/googleSearchFinder/")

testlist <- read.delim("temp.txt", header=FALSE, stringsAsFactors = FALSE, sep = ",")
testlist <- gsub('\'|http://|https://|www.|/|[ ]', '', testlist)
ordered099 <- read.delim("results/ordered0-99", header=FALSE, stringsAsFactors=FALSE, sep = ",")
ordered099 <- gsub('\\]|\\[|[ ]', '', ordered099)

testlist <- testlist[1:5]
newlist <- NULL
for (i in 1:length(testlist)) {
  tempstring <- i
  for (j in 1:length(ordered099)) {
    if (grepl(testlist[i], ordered099[j])) {
      if (is.numeric(tempstring))
        tempstring <- ordered099[j]
      else
        tempstring <- paste0(tempstring, ", ", ordered099[j])
    }
  }
  newlist <- rbind(newlist, tempstring)
}