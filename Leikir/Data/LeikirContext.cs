using Microsoft.EntityFrameworkCore;
using Leikir.Models;

namespace Leikir.Data;

public class LeikirContext : DbContext
{
    public DbSet<User> Users { get; set; }
    public DbSet<Score> Scores { get; set; }
    public DbSet<Game> Games { get; set; }

    public string DbPath { get; }

    public LeikirContext()
    {
        var folder = Environment.SpecialFolder.LocalApplicationData;
        var path = Environment.GetFolderPath(folder);
        DbPath = System.IO.Path.Join(path, "leikir.db");
        Console.WriteLine(DbPath);
    }

    // The following configures EF to create a Sqlite database file in the
    // special "local" folder for your platform.
    protected override void OnConfiguring(DbContextOptionsBuilder options)
        => options.UseSqlite($"Data Source={DbPath}");

    
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    // Configure relationships
    modelBuilder.Entity<User>()
        .HasMany(u => u.Scores)
        .WithOne(s => s.User)
        .HasForeignKey(s => s.UserId)
        .OnDelete(DeleteBehavior.Cascade);

    modelBuilder.Entity<Game>()
        .HasMany(g => g.Scores)
        .WithOne(s => s.Game)
        .HasForeignKey(s => s.GameId)
        .OnDelete(DeleteBehavior.Cascade);

    // Seed initial games
    modelBuilder.Entity<Game>().HasData(
        new Game
        {
            Id = 1,
            Name = "Orðla",
            Description = "Orðla er skemmtilegur og krefjandi orðaleikur þar sem markmiðið er að giska á fimm stafa orð í 6 eða færri tilraunum. " +
                          "Eftir hverja tilraun fær leikmaður vísbendingar. Grænn litur þýðir að stafurinn er réttur og á réttum stað. " +
                          "Gulur litur þýðir að stafurinn er í orðinu en á röngum stað. Grár litur þýðir að stafurinn er ekki í orðinu. " +
                          "Leikmaðurinn vinnu leikinn ef hann gískar á rétt orð í 6 eða færri tilraunum. Ef leikmaður nær hinsvegar ekki að gíska á orðið í 6 tilraunum, þá tapar hann leiknum."
        },
        new Game
        {
            Id = 2,
            Name = "Hengiman",
            Description = "Hengiman er leikur sem við ættum flest að kannast við. Markmiðið er að gíska á leyniorðið áður en 'hengingin er fullgerð" +
                          "Í hverri umferð gískar leikmaður á einn staf. Ef stafurinn er í leyniorðinu þá birtist hann á réttum stað/stöðum." +
                          "Ef stafurinn er ekki í orðinu þá bætist við einn hluti af hengingunni." +
                          "Leikmaðurinn tapar leiknum ef hann gerir of margar rangar tilraunir og hengingin klárast." +
                          "Leikmaður vinnur leikinn ef hann giskar á leyniorðið áður en hengingunni er lokið."
        }
    );
}
}