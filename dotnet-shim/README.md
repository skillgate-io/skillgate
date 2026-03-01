# SkillGate .NET Shim

.NET client for SkillGate sidecar runtime policy decisions.

![SkillGate shield](https://raw.githubusercontent.com/skillgate-io/skillgate/main/vscode-extension/assets/extension-icon.png)

## Projects

- `SkillGate.Client` - runtime client library
- `SkillGate.Client.Tests` - test suite

## Test and pack

```bash
cd dotnet-shim
dotnet test SkillGate.Client.Tests/SkillGate.Client.Tests.csproj
dotnet pack SkillGate.Client/SkillGate.Client.csproj -c Release
```

## Publish (maintainers)

```bash
cd dotnet-shim
dotnet nuget push SkillGate.Client/bin/Release/SkillGate.Client.VERSION.nupkg \
  --api-key "$NUGET_API_KEY" \
  --source https://api.nuget.org/v3/index.json
```

Runbook: [`../docs/Release/PUBLISH-DOTNET.md`](../docs/Release/PUBLISH-DOTNET.md)
