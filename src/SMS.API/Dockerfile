FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080
RUN apt-get update && apt-get install -y --no-install-recommends libgssapi-krb5-2 && rm -rf /var/lib/apt/lists/*

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["src/SMS.API/SMS.API.csproj", "SMS.API/"]
COPY ["src/SMS.Application/SMS.Application.csproj", "SMS.Application/"]
COPY ["src/SMS.Domain/SMS.Domain.csproj", "SMS.Domain/"]
COPY ["src/SMS.Infrastructure/SMS.Infrastructure.csproj", "SMS.Infrastructure/"]
RUN dotnet restore "SMS.API/SMS.API.csproj"
COPY src/ .
WORKDIR "/src/SMS.API"
RUN dotnet build -c Release -o /app/build

FROM build AS publish
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "SMS.API.dll"]
