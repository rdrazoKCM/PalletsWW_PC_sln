namespace PalletsWW_PC.Api.Services;

public interface IUsbPrintService
{
    Task<(bool Exitoso, string Mensaje)> EnviarZplAImpresoraUsbAsync(string codigoZpl);
    (bool Conectada, string NombreImpresora, string Mensaje) VerificarEstadoImpresora();
}
