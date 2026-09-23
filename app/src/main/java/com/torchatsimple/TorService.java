package com.torchatsimple;
import android.app.Service; import android.content.Intent; import android.os.IBinder;
import java.io.*;
import java.net.ServerSocket; import java.net.Socket;
public class TorService extends Service {
 String hsDir;
 @Override public void onCreate(){
  super.onCreate();
  hsDir=getFilesDir()+"/torhs";
  new File(hsDir).mkdirs();
  // Start simple http server on 8080 for HTML to talk
  new Thread(()->{ try{ ServerSocket ss=new ServerSocket(8080);
   while(true){ Socket s=ss.accept(); handle(s); }
  }catch(Exception e){} }).start();
  // Here you init real Tor binary - use com.github.tladesignz:tor-android lib
  // Tor.getInstance().start(this, hsDir);
 }
 void handle(Socket s) throws Exception{
  BufferedReader in=new BufferedReader(new InputStreamReader(s.getInputStream()));
  String line=in.readLine(); if(line==null) return;
  String resp="HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\n\r\n";
  if(line.contains("/getId")){
   String id=getOrCreateId(); resp+=id;
  } else if(line.contains("/inbox")){ resp+="[]";
  } else if(line.contains("/send")){ resp+="ok"; }
  s.getOutputStream().write(resp.getBytes()); s.close();
 }
 String getOrCreateId(){
  File f=new File(hsDir+"/id.txt");
  try{ if(f.exists()) return new String(java.nio.file.Files.readAllBytes(f.toPath()));
   String id=java.util.UUID.randomUUID().toString().replace("-","").substring(0,16).toLowerCase();
   FileWriter w=new FileWriter(f); w.write(id); w.close(); return id;
  }catch(Exception e){ return "abcd1234efgh5678"; }
 }
 @Override public IBinder onBind(Intent i){return null;}
}