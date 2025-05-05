#!/bin/bash

current=$(powerprofilesctl get)
if [ "$1" = "toggle" ]; then
  if [ "$current" = "performance" ]; then
    powerprofilesctl set balanced
  elif [ "$current" = "balanced" ]; then
    powerprofilesctl set power-saver
  else
    powerprofilesctl set performance
  fi
  current=$(powerprofilesctl get)
fi

icon="⚡"
case $current in
performance) icon=" Performance" ;;
balanced) icon=" Balanced" ;;
power-saver) icon=" Power Save" ;;
esac

echo "$icon"
