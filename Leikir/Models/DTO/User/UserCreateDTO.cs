using System.ComponentModel.DataAnnotations;

namespace Leikir.Models.DTO.User;

public class UserCreateDTO
{
    [Required]
    [StringLength(256)]
    public string Name { get; set; } = null!;
    
    [Required]
    [StringLength(256)]
    public string Username { get; set; } = null!;
    
    [Required]
    [EmailAddress]
    public string Email { get; set; } = null!;
    
    [Required]
    [MinLength(8)]
    [MaxLength(128)]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$",
        ErrorMessage = "Password must contain at least one uppercase letter, one lowercase letter, and one number")]
    public string Password { get; set; } = null!;
}