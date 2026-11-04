using PalletsWW_PC.Web.Services;

var builder = WebApplication.CreateBuilder(args);

// Configuracion de Circuitos Blazor y SignalR de Larga Duracion (Turno Industrial de 8 Horas)
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents(circuitOptions =>
    {
        circuitOptions.DisconnectedCircuitRetentionPeriod = TimeSpan.FromHours(8);
        circuitOptions.DisconnectedCircuitMaxRetained = 200;
    });

builder.Services.AddSignalR(hubOptions =>
{
    hubOptions.ClientTimeoutInterval = TimeSpan.FromMinutes(2);
    hubOptions.KeepAliveInterval = TimeSpan.FromSeconds(15);
    hubOptions.HandshakeTimeout = TimeSpan.FromSeconds(30);
    hubOptions.EnableDetailedErrors = true;
});

// Api Client Services
var apiBaseUrl = builder.Configuration["ApiSettings:BaseUrl"] ?? "http://10.26.24.31:5105/";
builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(apiBaseUrl) });

builder.Services.AddScoped<PalletsApiService>();
builder.Services.AddScoped<ValesApiService>();
builder.Services.AddScoped<CatalogosApiService>();
builder.Services.AddScoped<CatalogCacheService>();
builder.Services.AddScoped<ImpresionApiService>();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    app.UseHsts();
}

app.UseStaticFiles();
app.UseAntiforgery();

// Endpoint de verificacion y Keep-Alive para evitar suspension de pestanas en navegadores
app.MapGet("/api/health", () => Results.Ok(new { status = "OK", timestamp = DateTime.Now }));

app.MapRazorComponents<PalletsWW_PC.Web.Components.App>()
    .AddInteractiveServerRenderMode();

app.Run();