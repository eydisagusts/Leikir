using Leikir.Data;
using Leikir.Data.Games.Hangman;
using Leikir.Data.Games.Wordle;
using Leikir.Data.Interfaces;
using Leikir.Data.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Leikir;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        // Add services to the container.

        builder.Services.AddControllers();
        builder.Services.AddScoped<IRepository, LeikirRepository>();
        // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();
        builder.Services.AddControllersWithViews().AddNewtonsoftJson(options =>
            options.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore
        );

        // Add DbContext
        builder.Services.AddDbContext<LeikirContext>();

        // Add game services
        builder.Services.AddScoped<WordleGameService>();
        builder.Services.AddScoped<HangmanGameService>();
        builder.Services.AddSingleton<WordleWordValidator>();
        builder.Services.AddSingleton<TargetWordList>();

        var app = builder.Build();

        // Configure the HTTP request pipeline.
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        app.UseHttpsRedirection();

        app.UseAuthorization();


        app.MapControllers();

        app.Run();
    }
}