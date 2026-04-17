# Replace Order

Global replace runs after file-level and fragment-level replacements.

<?code-excerpt replace="/bonjour/hola/g"?>

<?code-excerpt "basic.dart" replace="/hello/bonjour/g;/world/mundo/g"?>

```
var greeting = 'hola';
var scope = 'mundo!';

void main() => print('$greeting $scope');
```

Resetting the file-level replace leaves only the fragment replace.

<?code-excerpt replace=""?>
<?code-excerpt "basic.dart" replace="/hello/bonjour/g"?>

```
var greeting = 'bonjour';
var scope = 'world';

void main() => print('$greeting $scope');
```
