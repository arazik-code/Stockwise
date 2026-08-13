FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080
RUN apt-get update && apt-get install -y --no-install-recommends libgssapi-krb5-2 curl && rm -rf /var/lib/apt/lists/*
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

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
COPY --from=publish --chown=$APP_UID:$APP_UID /app/publish .
# docker-compose.yml mounts a named volume at wwwroot/uploads. Docker only copies a named volume's
# initial content/ownership from the image path on first creation, and only if that path already
# exists in the image - it was previously created lazily at runtime by ImageStorageService, so the
# volume initialized empty and root-owned, unwritable by the non-root $APP_UID below, and every
# image upload 500'd.
RUN mkdir -p /app/wwwroot/uploads/products && chown -R $APP_UID:$APP_UID /app/wwwroot/uploads
USER $APP_UID
ENTRYPOINT ["dotnet", "SMS.API.dll"]
