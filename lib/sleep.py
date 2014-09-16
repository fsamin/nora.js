#!/usr/bin/python

import time
import sys

sleep = 1
if len(sys.argv) >= 2:
	sleep =  sys.argv[1]

time.sleep(float(sleep))

