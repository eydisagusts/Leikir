using System.ComponentModel.DataAnnotations;

namespace Leikir.Models.DTO.User;

public class UserLoginDTO
{
    [Required]
    public string Email { get; set; } = null!;
    [Required]
    public string Password { get; set; } = null!;
}