using System.Reflection;
using Kcc.Infrastructure.Sql.Configuration;
using Kcc.Infrastructure.Sql.Providers;
using Kcc.Infrastructure.Sql.Extensions;
using Microsoft.OpenApi.Models;
using PalletsWW_PC.Api.Data.Repositories;
using PalletsWW_PC.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// KCC SQL Infrastructure
var kccOptions = builder.Configuration
    .GetSection("KccConnection")
    .Get<KccConnectionOptions>();

if (kccOptions is null)
    throw new Exception("No se encontró la sección KccConnection en appsettings.json");

builder.Services.AddKccSqlInfrastructure(builder.Configuration);

// DI Repositories & Services
builder.Services.AddScoped<IPalletRepository, PalletRepository>();
builder.Services.AddScoped<IValeRepository, ValeRepository>();
builder.Services.AddScoped<ICatalogoRepository, CatalogoRepository>();
builder.Services.AddScoped<IImpresionRepository, ImpresionRepository>();
builder.Services.AddScoped<IAsistenciaRepository, AsistenciaRepository>();
builder.Services.AddScoped<IUsbPrintService, UsbPrintService>();

// Controllers & Swagger
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo 
    { 
        Title = "PalletsWW_PC.Api", 
        Version = "v1",
        Description = "API Corporativa para Captura y Gestión de Pallets Wet Wipes (Planta Tlaxcala). Cada endpoint indica explícitamente el Stored Procedure que ejecuta."
    });

    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        c.IncludeXmlComments(xmlPath);
    }
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", p =>
    {
        p.AllowAnyOrigin()
         .AllowAnyHeader()
         .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment() || true)
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "PalletsWW_PC.Api v1");
        c.RoutePrefix = "swagger";
        c.DocExpansion(Swashbuckle.AspNetCore.SwaggerUI.DocExpansion.List);
    });
}

app.UseCors("AllowAll");
app.UseAuthorization();
app.MapControllers();

app.Run();
