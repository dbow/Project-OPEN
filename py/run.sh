#!/bin/bash

for lib in `ls lib` ; do
  PYTHONPATH=$PYTHONPATH:lib/$lib
done

export PYTHONPATH

python homeless.py
