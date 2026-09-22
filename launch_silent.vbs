Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
Set WshShell = CreateObject("WScript.Shell")
' Run start.bat hidden (0 = hidden window), waiting = False so VBS exits immediately
WshShell.Run chr(34) & scriptDir & "\start.bat" & Chr(34), 0, False
Set WshShell = Nothing
Set fso = Nothing
