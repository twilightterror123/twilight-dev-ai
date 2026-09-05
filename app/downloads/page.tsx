export default function DownloadsPage() {
  const releases = "https://github.com/twilightterror123/twilight-dev-ai/releases/latest/download";
  return (
    <main style={{minHeight:"100vh",background:"#0b0b0b",color:"#eee",fontFamily:"Inter,system-ui,sans-serif",padding:"48px 24px"}}>
      <div style={{maxWidth:760,margin:"0 auto"}}>
        <a href="/" style={{color:"#999",textDecoration:"none"}}>← Back to TWILIGHT</a>
        <h1 style={{fontSize:38,margin:"48px 0 8px"}}>Download TWILIGHT</h1>
        <p style={{color:"#888",marginBottom:32}}>Install the TWILIGHT AI app on your device.</p>
        <div style={{display:"grid",gap:12}}>
          <a href={`${releases}/Twilight-latest-windows.exe`} style={card}>Windows · EXE<span>Download for Windows 10/11</span></a>
          <a href={`${releases}/Twilight-latest-linux.deb`} style={card}>Linux · DEB<span>Download for Debian, Ubuntu and compatible systems</span></a>
          <a href={`${releases}/Twilight-latest-android.apk`} style={card}>Android · APK<span>Install directly on Android</span></a>
        </div>
        <p style={{color:"#555",fontSize:13,marginTop:24}}>Downloads are built automatically from the latest TWILIGHT source.</p>
      </div>
    </main>
  );
}

const card = {
  display:"flex", flexDirection:"column", gap:7, padding:"18px 20px", border:"1px solid #292929",
  borderRadius:14, background:"#151515", color:"#eee", textDecoration:"none", fontSize:16
} as const;
