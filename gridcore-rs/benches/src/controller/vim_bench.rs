use criterion::{BenchmarkId, Criterion, criterion_group, criterion_main};
use gridcore_controller::behaviors::vim::vim_parser::VimParser;
use std::hint::black_box;

fn bench_vim_command_parsing(c: &mut Criterion) {
    let mut group = c.benchmark_group("vim_command_parsing");

    let commands = vec![
        ("simple_move", "10j"),
        ("complex_move", "100gg"),
        ("delete", "d10w"),
        ("yank", "y$"),
        ("visual", "v10j"),
        ("ex_command", ":w"),
        ("search", "/pattern"),
    ];

    for (name, cmd) in commands {
        group.bench_with_input(BenchmarkId::from_parameter(name), &cmd, |b, &command| {
            b.iter(|| VimParser::parse_command(black_box(command)));
        });
    }

    group.finish();
}

fn bench_bulk_vim_commands(c: &mut Criterion) {
    let mut group = c.benchmark_group("bulk_vim_commands");

    for num_commands in [10, 100, 1000].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(num_commands),
            num_commands,
            |b, &count| {
                let commands: Vec<_> = (0..count)
                    .map(|i| match i % 4 {
                        0 => "j",
                        1 => "k",
                        2 => "h",
                        3 => "l",
                        _ => unreachable!(),
                    })
                    .collect();

                b.iter(|| {
                    let mut results = Vec::new();
                    for cmd in &commands {
                        if let Ok(result) = VimParser::parse_command(black_box(cmd)) {
                            results.push(result);
                        }
                    }
                    results
                });
            },
        );
    }

    group.finish();
}

fn bench_complex_vim_sequences(c: &mut Criterion) {
    let mut group = c.benchmark_group("complex_vim_sequences");

    let sequences = vec![
        (
            "navigation_sequence",
            vec!["10j", "5l", "gg", "G", "$", "0"],
        ),
        ("edit_sequence", vec!["i", "cw", "dd", "p"]),
        ("visual_sequence", vec!["v", "10j", "5l", "d"]),
    ];

    for (name, seq) in sequences {
        group.bench_with_input(BenchmarkId::from_parameter(name), &seq, |b, sequence| {
            b.iter(|| {
                let mut results = Vec::new();
                for cmd in sequence {
                    if let Ok(result) = VimParser::parse_command(black_box(cmd)) {
                        results.push(result);
                    }
                }
                results
            });
        });
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_vim_command_parsing,
    bench_bulk_vim_commands,
    bench_complex_vim_sequences
);
criterion_main!(benches);
