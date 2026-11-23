Option Explicit

Dim fso, shell, appDir, nodeExe, processEnv, probe, ready, attempt, edgePath, appUrl, openCommand
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

appDir = fso.GetParentFolderName(WScript.ScriptFullName)
nodeExe = appDir & "\node.exe"

If Not fso.FileExists(nodeExe) Then
  MsgBox "Xunye files are missing. Please reinstall.", 16, "Xunye"
  WScript.Quit 1
End If

shell.CurrentDirectory = appDir
Set processEnv = shell.Environment("PROCESS")
processEnv("HOST") = "127.0.0.1"
processEnv("PORT") = "3777"
processEnv("NODE_ENV") = "production"

ready = False
On Error Resume Next
Set probe = CreateObject("MSXML2.XMLHTTP")
probe.Open "GET", "http://127.0.0.1:3777/api/health", False
probe.Send
If Err.Number = 0 And probe.Status = 200 Then
  ready = True
End If
Err.Clear
On Error GoTo 0

If Not ready Then
  shell.Run Chr(34) & nodeExe & Chr(34) & " server\index.js", 0, False
  For attempt = 1 To 24
    WScript.Sleep 250
    On Error Resume Next
    Set probe = CreateObject("MSXML2.XMLHTTP")
    probe.Open "GET", "http://127.0.0.1:3777/api/health", False
    probe.Send
    If Err.Number = 0 And probe.Status = 200 Then
      ready = True
      Err.Clear
      On Error GoTo 0
      Exit For
    End If
    Err.Clear
    On Error GoTo 0
  Next
End If

If Not ready Then
  MsgBox "Xunye could not start. Port 3777 may be in use.", 16, "Xunye"
  WScript.Quit 1
End If

appUrl = "http://localhost:3777"
edgePath = shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe"
If Not fso.FileExists(edgePath) Then
  edgePath = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe"
End If

If fso.FileExists(edgePath) Then
  openCommand = Chr(34) & edgePath & Chr(34) & " --app=" & appUrl & " --window-size=430,920"
  shell.Run openCommand, 1, False
Else
  shell.Run appUrl, 1, False
End If
