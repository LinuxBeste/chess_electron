#!/bin/sh
# processes.sh - Get process list as JSON
# Fast path: uses ps (works with GNU or BusyBox)
# /host/proc is handled by the Node.js endpoint directly

output=$(ps -eo user=,pid=,%cpu=,%mem=,vsz=,rss=,args= --no-headers --sort=-%cpu 2>/dev/null)
if [ -n "$output" ]; then
  echo "$output" | awk '
  BEGIN { printf "["; sep="" }
  {
    user=$1; pid=$2+0; cpu=$3+0; mem=$4+0; vsz=$5+0; rss=$6+0
    cmd=""; for(i=7;i<=NF;i++) cmd=cmd (i>7?" ":"") $i
    gsub(/\\/,"\\\\",cmd); gsub(/"/,"\\\"",cmd); gsub(/\t/,"\\t",cmd); gsub(/\n/,"\\n",cmd)
    printf "%s{\"user\":\"%s\",\"pid\":%d,\"cpu\":%.1f,\"mem\":%.1f,\"vsz\":%d,\"rss\":%d,\"command\":\"%s\"}", sep, user, pid, cpu, mem, vsz*1024, rss*1024, cmd
    sep=","
  }
  END { printf "]\n" }'
  exit $?
fi

# Fallback: BusyBox ps (no %cpu, %mem)
output=$(ps -o user=,pid=,vsz=,rss=,args= 2>/dev/null)
if [ -n "$output" ]; then
  echo "$output" | awk '
  function to_kb(s) {
    if(s~/[gG]$/) return substr(s,1,length(s)-1)*1048576
    if(s~/[mM]$/) return substr(s,1,length(s)-1)*1024
    if(s~/[kK]$/) return substr(s,1,length(s)-1)
    return s+0
  }
  BEGIN { printf "["; sep="" }
  {
    user=$1; pid=$2+0; vsz=to_kb($3); rss=to_kb($4); cpu=0; mem=0
    cmd=""; for(i=5;i<=NF;i++) cmd=cmd (i>5?" ":"") $i
    gsub(/\\/,"\\\\",cmd); gsub(/"/,"\\\"",cmd); gsub(/\t/,"\\t",cmd); gsub(/\n/,"\\n",cmd)
    printf "%s{\"user\":\"%s\",\"pid\":%d,\"cpu\":%.1f,\"mem\":%.1f,\"vsz\":%d,\"rss\":%d,\"command\":\"%s\"}", sep, user, pid, cpu, mem, vsz*1024, rss*1024, cmd
    sep=","
  }
  END { printf "]\n" }'
  exit $?
fi

echo '[]'
