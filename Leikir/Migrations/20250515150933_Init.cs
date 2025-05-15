using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Leikir.Migrations
{
    /// <inheritdoc />
    public partial class Init : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Games",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Games", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Username = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Email = table.Column<string>(type: "TEXT", nullable: false),
                    Password = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Scores",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserId = table.Column<int>(type: "INTEGER", nullable: false),
                    GameId = table.Column<int>(type: "INTEGER", nullable: false),
                    UserScore = table.Column<int>(type: "INTEGER", nullable: false),
                    NumberOfAttempts = table.Column<int>(type: "INTEGER", nullable: true),
                    TimeInSeconds = table.Column<int>(type: "INTEGER", nullable: true),
                    GuessedWord = table.Column<string>(type: "TEXT", nullable: true),
                    AchivedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Scores", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Scores_Games_GameId",
                        column: x => x.GameId,
                        principalTable: "Games",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Scores_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Games",
                columns: new[] { "Id", "Description", "Name" },
                values: new object[,]
                {
                    { 1, "Orðla er skemmtilegur og krefjandi orðaleikur þar sem markmiðið er að giska á fimm stafa orð í 6 eða færri tilraunum. Eftir hverja tilraun fær leikmaður vísbendingar. Grænn litur þýðir að stafurinn er réttur og á réttum stað. Gulur litur þýðir að stafurinn er í orðinu en á röngum stað. Grár litur þýðir að stafurinn er ekki í orðinu. Leikmaðurinn vinnu leikinn ef hann gískar á rétt orð í 6 eða færri tilraunum. Ef leikmaður nær hinsvegar ekki að gíska á orðið í 6 tilraunum, þá tapar hann leiknum.", "Orðla" },
                    { 2, "Hengiman er leikur sem við ættum flest að kannast við. Markmiðið er að gíska á leyniorðið áður en 'hengingin er fullgerðÍ hverri umferð gískar leikmaður á einn staf. Ef stafurinn er í leyniorðinu þá birtist hann á réttum stað/stöðum.Ef stafurinn er ekki í orðinu þá bætist við einn hluti af hengingunni.Leikmaðurinn tapar leiknum ef hann gerir of margar rangar tilraunir og hengingin klárast.Leikmaður vinnur leikinn ef hann giskar á leyniorðið áður en hengingunni er lokið.", "Hengiman" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Scores_GameId",
                table: "Scores",
                column: "GameId");

            migrationBuilder.CreateIndex(
                name: "IX_Scores_UserId",
                table: "Scores",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Scores");

            migrationBuilder.DropTable(
                name: "Games");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
