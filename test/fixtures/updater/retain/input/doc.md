## Test retain transform op

Plain string argument:

<?code-excerpt "basic.dart" retain="$greeting"?>
```dart
old
```

Regexp argument:

<?code-excerpt "basic.dart" retain="/^v/"?>
```dart
old
```

Plain string of the form `/.../`:

<?code-excerpt "indented_frag.dart" region="single-code-block" retain="\//"?>
```dart
old
```
