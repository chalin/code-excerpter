#!/usr/bin/env perl
#
# In-place line sort: drop blank lines, case-insensitive sort, deduplicate by
# fold-case, file always ends with a newline.

use strict;
use warnings;
use open ':std', ':encoding(UTF-8)';

@ARGV or die "usage: $0 FILE [FILE...]\n";

for my $path (@ARGV) {
  open my $fh, '<:encoding(UTF-8)', $path or die "$path: $!\n";
  my @lines = <$fh>;
  close $fh;
  chomp @lines;
  @lines = grep { /\S/ } @lines;
  @lines = sort { lc($a) cmp lc($b) } @lines;
  my %seen;
  @lines = grep { !$seen{ lc($_) }++ } @lines;
  open $fh, '>:encoding(UTF-8)', $path or die "$path: $!\n";
  print $fh join( "\n", @lines ), "\n";
  close $fh;
}
