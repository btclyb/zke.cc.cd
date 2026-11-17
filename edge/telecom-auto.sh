#!/bin/bash
# EdgeLens local Cloudflare selection. macOS /bin/bash 3.2, curl and awk only.
set -u
PATH=/usr/bin:/bin:/usr/sbin:/sbin
APP="$HOME/Library/Application Support/EdgeLens"
LABEL="cc.edgelens.telecom"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
MODE="${1:-install}"
CURL=/usr/bin/curl
network_id() {
  local iface gateway wifi
  iface=$(/sbin/route -n get default 2>/dev/null | /usr/bin/awk '/interface:/{print $2;exit}')
  gateway=$(/sbin/route -n get default 2>/dev/null | /usr/bin/awk '/gateway:/{print $2;exit}')
  case "$iface" in ''|utun*|tun*|ppp*) return 1;; esac
  wifi=$(/usr/sbin/networksetup -getairportnetwork "$iface" 2>/dev/null || true)
  printf '%s\n%s\n%s\n' "$iface" "$gateway" "$wifi" | /usr/bin/shasum -a 256 | /usr/bin/awk '{print $1}'
}
if [ "$MODE" = uninstall ]; then
  /bin/launchctl unload "$PLIST" 2>/dev/null || true
  /bin/rm -f "$PLIST"
  printf '已停止自动测速。结果保留在：%s\n' "$APP"
  exit 0
fi
if [ "$MODE" = install ]; then
  [ "$(/usr/bin/uname -s)" = Darwin ] || { echo '此安装器只用于 macOS。'; exit 1; }
  echo '请先连接家中电信网络，并关闭 VPN／代理增强模式。无需管理员密码。'
  ID=$(network_id) || { echo '检测到 VPN 隧道或没有默认网络，请关闭 VPN 后重试。'; exit 1; }
  /bin/mkdir -p "$APP" "$HOME/Library/LaunchAgents"
  /bin/cp "$0" "$APP/telecom-auto.sh"
  /bin/chmod 700 "$APP/telecom-auto.sh"
  printf '%s\n' "$ID" > "$APP/network.sha256"
  # XML-escape the user home path before creating the launchd job.
  ESC_APP=$(printf '%s' "$APP" | /usr/bin/sed 's/\&/\&amp;/g;s/</\&lt;/g;s/>/\&gt;/g;s/"/\&quot;/g')
  cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>$LABEL</string>
<key>ProgramArguments</key><array><string>/bin/bash</string><string>$ESC_APP/telecom-auto.sh</string><string>run</string></array>
<key>RunAtLoad</key><true/><key>StartInterval</key><integer>21600</integer>
<key>StandardOutPath</key><string>$ESC_APP/run.log</string>
<key>StandardErrorPath</key><string>$ESC_APP/run.log</string>
<key>ProcessType</key><string>Background</string>
</dict></plist>
PLIST
  /bin/chmod 600 "$PLIST"
  /usr/bin/plutil -lint "$PLIST" || exit 1
  /bin/launchctl unload "$PLIST" 2>/dev/null || true
  /bin/launchctl load "$PLIST" || exit 1
  echo '已安装：登录后每 6 小时测速；电脑睡眠时不会强制唤醒。'
  echo '首轮约需 2–5 分钟，之后在下列目录查看 addresses.txt 和 result.csv：'
  echo "$APP"
  /usr/bin/open "$APP"
  exit 0
fi
[ "$MODE" = run ] || { echo '用法：bash telecom-auto.sh [install|run|uninstall]'; exit 1; }
/bin/mkdir -p "$APP"
# launchd serializes scheduled runs; this lock also prevents overlapping manual runs.
LOCK="$APP/scan.lock"
if ! /bin/mkdir "$LOCK" 2>/dev/null; then
  PID=$(/bin/cat "$LOCK/pid" 2>/dev/null || true)
  if [ -n "$PID" ] && /bin/kill -0 "$PID" 2>/dev/null; then exit 0; fi
  /bin/rm -rf "$LOCK"
  /bin/mkdir "$LOCK" || exit 0
fi
printf '%s\n' "$$" > "$LOCK/pid"
TMP=$(/usr/bin/mktemp -d "$APP/work.XXXXXX") || exit 1
trap '/bin/rm -rf "$TMP" "$LOCK"' EXIT HUP INT TERM
ID=$(network_id) || { echo "$(date): VPN 或离线，跳过检测。"; exit 0; }
[ "$ID" = "$(/bin/cat "$APP/network.sha256" 2>/dev/null)" ] || { echo "$(date): 网络与安装时不同，跳过，避免混入其他网络的结果。"; exit 0; }
# No proxy, no credentials, no insecure TLS. No benchmark against arbitrary targets.
if ! "$CURL" -fsS --noproxy '*' --proxy '' --connect-timeout 5 --max-time 12 https://www.cloudflare.com/ips-v4 -o "$TMP/ranges"; then echo '无法取得 Cloudflare 官方网段，保留上次结果。'; exit 1; fi
/usr/bin/awk '
function valid(s, a,n,i){n=split(s,a,".");if(n!=4)return 0;for(i=1;i<=4;i++)if(a[i]!~/^[0-9]+$/||a[i]>255)return 0;return 1}
BEGIN{srand()}
{split($0,r,"/"); if(!valid(r[1])||r[2]!~/^[0-9]+$/||r[2]<12||r[2]>24)next;split(r[1],a,".");base=((a[1]*256+a[2])*256+a[3])*256+a[4];size=2^(32-r[2]);for(i=0;i<2;i++){v=base+1+int(rand()*(size-2));o4=v%256;v=int(v/256);o3=v%256;v=int(v/256);o2=v%256;o1=int(v/256);printf "%d.%d.%d.%d\n",o1,o2,o3,o4}}' "$TMP/ranges" | /usr/bin/awk '!seen[$0]++' > "$TMP/ips"
[ -s "$TMP/ips" ] || { echo '官方网段格式不正确，停止。'; exit 1; }
: > "$TMP/latency"
while IFS= read -r IP; do
  # Skip any candidate that the actual route directs through a VPN tunnel.
  IFACE=$(/sbin/route -n get "$IP" 2>/dev/null | /usr/bin/awk '/interface:/{print $2;exit}')
  case "$IFACE" in ''|utun*|tun*|ppp*) continue;; esac
  OK=0;SUM=0
  for ROUND in 1 2; do
    R=$("$CURL" -s --noproxy '*' --proxy '' --resolve "speed.cloudflare.com:443:$IP" --connect-timeout 2 --max-time 4 -o /dev/null -w '%{http_code} %{time_starttransfer} %{size_download}' 'https://speed.cloudflare.com/__down?bytes=16384' 2>/dev/null) || continue
    read -r CODE TIME BYTES <<< "$R"
    if [ "$CODE" = 200 ] && [ "$BYTES" = 16384 ]; then OK=$((OK+1));SUM=$(/usr/bin/awk -v a="$SUM" -v b="$TIME" 'BEGIN{print a+b}');fi
  done
  if [ "$OK" = 2 ]; then /usr/bin/awk -v ip="$IP" -v t="$SUM" 'BEGIN{printf "%s %.1f\n",ip,t*500}' >> "$TMP/latency";fi
done < "$TMP/ips"
/usr/bin/sort -k2,2n "$TMP/latency" | /usr/bin/head -8 > "$TMP/top"
: > "$TMP/speed"
while read -r IP MS; do
  [ -n "$IP" ] || continue
  R=$("$CURL" -s --noproxy '*' --proxy '' --resolve "speed.cloudflare.com:443:$IP" --connect-timeout 2 --max-time 8 -o /dev/null -w '%{http_code} %{speed_download} %{size_download}' 'https://speed.cloudflare.com/__down?bytes=1048576' 2>/dev/null) || continue
  read -r CODE SPEED BYTES <<< "$R"
  if [ "$CODE" = 200 ] && [ "$BYTES" = 1048576 ]; then printf '%s %s %s\n' "$IP" "$MS" "$SPEED" >> "$TMP/speed";fi
done < "$TMP/top"
# Require a stable network throughout the scan; never replace valid results with an empty list.
END_ID=$(network_id) || exit 1
[ "$END_ID" = "$ID" ] || { echo '测速期间网络发生变化，结果不采用。'; exit 1; }
[ -s "$TMP/speed" ] || { echo "$(date): 没有通过的地址，保留上次结果（查看其时间戳）。"; exit 1; }
/usr/bin/sort -k3,3nr -k2,2n "$TMP/speed" > "$TMP/ranked"
/usr/bin/awk '{printf "%s:443#电信本地-%.0fms-%.2fMBps\n",$1,$2,$3/1000000}' "$TMP/ranked" > "$TMP/addresses.txt"
printf 'IP Address,Port,Average HTTP TTFB ms,Download Speed MB/s,Measured At\n' > "$TMP/result.csv"
STAMP=$(/bin/date -u '+%Y-%m-%dT%H:%M:%SZ')
/usr/bin/awk -v t="$STAMP" '{printf "%s,443,%.1f,%.3f,%s\n",$1,$2,$3/1000000,t}' "$TMP/ranked" >> "$TMP/result.csv"
/bin/mv "$TMP/addresses.txt" "$APP/addresses.txt"
/bin/mv "$TMP/result.csv" "$APP/result.csv"
printf '%s\n' "$STAMP" > "$APP/updated-at.txt"
echo "$STAMP: 完成电信本地测速，结果已更新。下载速度来自每个地址一次 1MiB 测试，仅作短样本参考。"
