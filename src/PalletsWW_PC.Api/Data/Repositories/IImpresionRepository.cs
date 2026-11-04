using PalletsWW_PC.Api.Models.Dtos;

namespace PalletsWW_PC.Api.Data.Repositories;

public interface IImpresionRepository
{
    Task<EtiquetaZplDto?> ObtenerDatosEtiquetaAsync(int idPallet);
    string ConstruirCodigoZpl(EtiquetaZplDto datos);
}
